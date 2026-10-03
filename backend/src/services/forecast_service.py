import logging
from typing import Dict, Any, List, Optional
from dataclasses import asdict

from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.forecaster import Forecaster
from src.domain.exceptions import MlError
from src.domain.value_objects import DateRange
from src.services.conformal import LEVELS, MIN_CALIBRATION_POINTS, conformal_quantile, intervals_around
from src.config import settings
from src.services.profit_analysis import (
    estimate_price_elasticity,
    identify_columns,
    profit_maximising_price,
    profit_report,
)

COST_WINDOW = 28
CALIBRATION_DAYS = 28
_conformal_cache: Dict[tuple, List[float]] = {}

logger = logging.getLogger(__name__)

class ForecastService:
    """Service for orchestrating forecasting tasks with dataset awareness and multi-lever simulation."""

    def __init__(self, uow: UnitOfWork, forecaster: Forecaster):
        self.uow = uow
        self.forecaster = forecaster

    async def _extract_series(self, dataset_id: Optional[str] = None) -> tuple[list[dict], str]:
        data, active_dataset_id, _target = await self._extract_series_meta(dataset_id)
        return data, active_dataset_id

    async def _extract_series_meta(self, dataset_id: Optional[str] = None) -> tuple[list[dict], str, str]:
        """Resolve a dataset to its aggregated daily series.

        Returns ``(data, active_dataset_id)`` where each row is
        ``{"date": str, "actual": float, <regressor>: float}``. Shared by
        training and backtesting so both see identical data.
        """
        async with self.uow as uow:
            from sqlalchemy import select, text
            from src.infrastructure.database.models import DatasetMetadata

            if dataset_id:
                query = select(DatasetMetadata).where(DatasetMetadata.id == dataset_id)
            else:
                query = select(DatasetMetadata).order_by(DatasetMetadata.upload_date.desc()).limit(1)

            result = await uow.repository.session.execute(query)
            dataset = result.scalar_one_or_none()

            if not dataset:
                target_desc = f"with ID '{dataset_id}' " if dataset_id else ""
                raise MlError(f"No dataset {target_desc}available for training.")

            active_dataset_id = str(dataset.id)
            table = dataset.generated_table_name
            mapping = dataset.column_mapping or {}

            target_metric = mapping.get("target_metric")
            primary_date = mapping.get("primary_date")

            if not target_metric or not primary_date:
                target_metric = target_metric or "units_sold"
                primary_date = primary_date or "date"

            from sqlalchemy import inspect
            connection = await uow.repository.session.connection()

            def _get_columns_info(conn):
                inspector = inspect(conn)
                if inspector.has_table(table):
                    return inspector.get_columns(table)
                return []

            cols_info = await connection.run_sync(_get_columns_info)
            meta_numerical = set(mapping.get("numerical_columns", []))

            available_regressors = []
            for c in cols_info:
                name = c['name']
                type_str = str(c['type']).upper()
                if name not in [target_metric, primary_date, 'id', 'created_at']:
                    if name in meta_numerical or any(t in type_str for t in ("INT", "NUMERIC", "FLOAT", "REAL", "DOUBLE", "DECIMAL")):
                        available_regressors.append(name)

            agg_str = ", ".join([f'AVG(CAST("{r}" AS NUMERIC)) as "{r}"' for r in available_regressors])
            if agg_str:
                agg_str = ", " + agg_str

            sql = text(f'''
                SELECT 
                    CAST("{primary_date}" AS DATE) as date,
                    SUM(CAST("{target_metric}" AS NUMERIC)) as actual
                    {agg_str}
                FROM "{table}"
                GROUP BY CAST("{primary_date}" AS DATE)
                ORDER BY CAST("{primary_date}" AS DATE) ASC
            ''')

            records = await uow.repository.session.execute(sql)

            data = []
            for r in records.mappings():
                row = {"date": str(r["date"]), "actual": float(r["actual"] or 0)}
                for reg in available_regressors:
                    if r.get(reg) is not None:
                        row[reg] = float(r[reg])
                data.append(row)

        if not data:
            raise MlError("No data available for training.")

        return data, active_dataset_id, target_metric

    async def train_model(self, granularity: str = "daily", dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract historical sales data for the specified dataset, train a new model, and return status.
        Binds model state explicitly to dataset_id.
        """
        logger.info(f"Initiating model training with {granularity} granularity (dataset_id={dataset_id}).")

        data, active_dataset_id = await self._extract_series(dataset_id=dataset_id)

        # Train model bound to active_dataset_id
        model_id = await self.forecaster.train(data, granularity=granularity, dataset_id=active_dataset_id)

        return {
            "message": "Model trained successfully",
            "training_id": model_id,
            "dataset_id": active_dataset_id,
            "data_points_used": len(data),
            "date_range": {
                "start": data[0]["date"],
                "end": data[-1]["date"]
            },
            "estimated_time_seconds": 0
        }

    async def backtest(self, test_days: int = 14, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Score the forecasting model on a held-out tail window (MAE/MAPE/RMSE)."""
        data, active_dataset_id = await self._extract_series(dataset_id=dataset_id)
        metrics = await self.forecaster.backtest(data, test_days=test_days)
        metrics.pop("abs_errors", None)
        return {
            "dataset_id": active_dataset_id,
            "data_points_used": len(data),
            **metrics,
        }

    async def get_forecast(self, horizon_days: int = 30, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Get history and future predictions for a specific dataset."""
        is_trained = await self.forecaster.is_trained(dataset_id=dataset_id)
        if not is_trained:
            target_str = f" for dataset '{dataset_id}'" if dataset_id else ""
            raise MlError(f"No trained forecasting model is available{target_str}. Please train a model first.")
            
        forecast = await self.forecaster.predict(horizon_days=horizon_days, dataset_id=dataset_id)
        
        latest_info = self.forecaster.get_latest_model_info(dataset_id=dataset_id)
        granularity = latest_info.get("metadata", {}).get("granularity", "daily") if latest_info else "daily"
        bound_dataset_id = dataset_id or (latest_info.get("metadata", {}).get("dataset_id") if latest_info else None)
        
        async with self.uow as uow:
            metrics = await uow.repository.get_summary_metrics(dataset_id=bound_dataset_id)
            timeline = metrics.get("timeline", [])
            
        history = [
            {"date": item["date"], "actual": item["value"]}
            for item in timeline
        ]
        
        forecast_points = [
            {
                "date": fp.date,
                "predicted": fp.predicted,
                "lower_bound": fp.lower_bound,
                "upper_bound": fp.upper_bound
            }
            for fp in forecast
        ]
        
        return {
            "model_info": {
                "trained_at": latest_info.get("created_at") if latest_info else None,
                "data_points_used": latest_info.get("metadata", {}).get("data_points_used") if latest_info else 0,
                "granularity": granularity,
                "dataset_id": bound_dataset_id
            },
            "dataset_id": bound_dataset_id,
            "history": history,
            "forecast": forecast_points
        }

    async def simulate(
        self,
        horizon_days: int,
        mutations: Dict[str, Any],
        dataset_id: Optional[str] = None,
        unit_cost: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Execute a counterfactual What-If simulation with mutated regressors and aligned lever contributions.
        """
        is_trained = await self.forecaster.is_trained(dataset_id=dataset_id)
        if not is_trained:
            target_str = f" for dataset '{dataset_id}'" if dataset_id else ""
            raise MlError(f"No trained forecasting model is available{target_str}. Please train a model first.")

        abs_errors, calibration_note = await self._calibration_errors(dataset_id)

        result = await self.forecaster.simulate_scenario(
            horizon_days=horizon_days,
            mutations=mutations,
            dataset_id=dataset_id,
            prophet_intervals=abs_errors is None,
        )

        resp = asdict(result)
        baseline_prophet = resp.pop("baseline_prophet_interval", None)
        mutated_prophet = resp.pop("mutated_prophet_interval", None)
        resp["uncertainty"] = self._build_uncertainty(
            resp["points"], abs_errors, calibration_note, baseline_prophet, mutated_prophet, horizon_days
        )
        resp["dataset_id"] = dataset_id
        baseline_paths = resp.pop("baseline_regressors", {})
        mutated_paths = resp.pop("mutated_regressors", {})
        resp["profit"], resp["pricing"] = await self._commercial_analysis(
            resp, baseline_paths, mutated_paths, dataset_id, unit_cost
        )

        # Fallback if shap forces were somehow empty
        if not resp.get("shap_positive_forces") and not resp.get("shap_negative_forces"):
            try:
                from src.infrastructure.ml.shap_engine import ShapEngine
                model = getattr(self.forecaster, "model", None)
                if model:
                    shap_engine = ShapEngine()
                    future = model.make_future_dataframe(periods=horizon_days, freq="D")
                    regressor_cols = getattr(self.forecaster, "_regressor_cols", [])
                    last_vals = getattr(self.forecaster, "_last_regressor_values", {})
                    for col in regressor_cols:
                        b_val = last_vals.get(col, 0.0)
                        if col in mutations:
                            m_val = getattr(self.forecaster, "_apply_mutation")(b_val, mutations[col])
                            future[col] = m_val
                        else:
                            future[col] = b_val
                    forecast_df = model.predict(future)
                    target_date = forecast_df["ds"].iloc[-1].strftime("%Y-%m-%d")
                    explanation = await shap_engine.compute_explanation(
                        model=model,
                        forecast_df=forecast_df,
                        target_date=target_date
                    )
                    resp["shap_positive_forces"] = [asdict(d) for d in explanation.top_positive_drivers]
                    resp["shap_negative_forces"] = [asdict(d) for d in explanation.top_negative_drivers]
            except Exception as e:
                logger.error(f"Fallback factor attribution failed: {e}")

        return resp

    async def _calibration_errors(self, dataset_id: Optional[str]) -> tuple[Optional[List[float]], Optional[str]]:
        """Held-out absolute errors for split-conformal intervals, cached per trained model.

        Returns ``(errors, None)`` or ``(None, reason)`` when the history is too short or the
        backtest fails, in which case the caller falls back to Prophet's own intervals.
        """
        try:
            data, _active_id = await self._extract_series(dataset_id)
            calib_days = min(CALIBRATION_DAYS, len(data) - settings.FORECAST_MIN_DATA_POINTS)
            if calib_days < MIN_CALIBRATION_POINTS:
                return None, (
                    f"Only {len(data)} days of history; split-conformal calibration needs at least "
                    f"{settings.FORECAST_MIN_DATA_POINTS + MIN_CALIBRATION_POINTS}."
                )
            info = self.forecaster.get_latest_model_info(dataset_id=dataset_id) or {}
            key = (info.get("model_id"), calib_days)
            if key[0] and key in _conformal_cache:
                return _conformal_cache[key], None
            metrics = await self.forecaster.backtest(data, test_days=calib_days)
            errors = list(metrics["abs_errors"])
            if key[0]:
                _conformal_cache[key] = errors
            return errors, None
        except Exception as e:
            logger.warning(f"Conformal calibration unavailable, using Prophet intervals: {e}")
            return None, "Backtest calibration failed."

    @staticmethod
    def _build_uncertainty(
        points: List[Dict[str, Any]],
        abs_errors: Optional[List[float]],
        note: Optional[str],
        baseline_prophet: Optional[Dict[str, List[float]]],
        mutated_prophet: Optional[Dict[str, List[float]]],
        horizon_days: int,
    ) -> Dict[str, Any]:
        dates = [p["date"] for p in points]
        if abs_errors is not None:
            levels: Dict[str, Any] = {}
            for level in LEVELS:
                q = conformal_quantile(abs_errors, level)
                if q is None:
                    continue
                levels[f"{int(level * 100)}"] = {
                    "half_width": round(q, 2),
                    "baseline": intervals_around([p["baseline_predicted"] for p in points], q),
                    "scenario": intervals_around([p["mutated_predicted"] for p in points], q),
                }
            calibration_days = len(abs_errors)
            notes = [
                "Intervals are the point forecast ± the holdout error quantile; they describe model error, "
                "not uncertainty about the lever values."
            ]
            if horizon_days > calibration_days:
                notes.append(
                    f"Calibrated on a {calibration_days}-day holdout; days beyond that are likely wider than shown."
                )
            return {
                "method": "split_conformal",
                "calibration_points": calibration_days,
                "dates": dates,
                "levels": levels,
                "notes": notes,
            }
        return {
            "method": "prophet_intervals",
            "calibration_points": None,
            "dates": dates,
            "levels": {
                "80": {"baseline": baseline_prophet, "scenario": mutated_prophet},
            },
            "notes": [note] if note else [],
        }

    async def _commercial_analysis(
        self,
        resp: Dict[str, Any],
        baseline_paths: Dict[str, List[float]],
        mutated_paths: Dict[str, List[float]],
        dataset_id: Optional[str],
        unit_cost: Optional[float],
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """Gross profit and price optimisation for a simulation; never fails the simulation itself."""
        try:
            data, _active_id, target_metric = await self._extract_series_meta(dataset_id)
            regressors = [k for k in (data[0] if data else {}) if k not in ("date", "actual")]
            cols = identify_columns(regressors, target_metric)

            points = resp["points"]
            profit = profit_report(
                [p["baseline_predicted"] for p in points],
                [p["mutated_predicted"] for p in points],
                baseline_paths,
                mutated_paths,
                cols,
                request_unit_cost=unit_cost,
            )

            price_col = cols["price"]
            if not cols["target_is_units"] or not price_col:
                reason = (
                    "The forecast target is not a unit volume, so price elasticity of volume cannot be estimated."
                    if not cols["target_is_units"]
                    else "No price column was found."
                )
                return profit, {"elasticity": None, "optimal_price": {"price": None, "reason": reason}}

            complete = [r for r in data if all(k in r for k in regressors)]
            controls_cols = [c for c in regressors if c not in (price_col, cols["cost"])]
            fit = estimate_price_elasticity(
                [r[price_col] for r in complete],
                [r["actual"] for r in complete],
                {c: [r[c] for r in complete] for c in controls_cols},
            )

            cost_value = unit_cost
            if cost_value is None and cols["cost"]:
                recent = [r[cols["cost"]] for r in complete[-COST_WINDOW:]]
                cost_value = sum(recent) / len(recent) if recent else None
            prices = [r[price_col] for r in complete]
            optimum = profit_maximising_price(fit, cost_value, (min(prices), max(prices)) if prices else None)
            return profit, {"elasticity": fit, "optimal_price": optimum}
        except Exception as e:
            logger.error(f"Commercial analysis failed: {e}")
            reason = "Profit analysis could not be computed for this dataset."
            return (
                {"available": False, "reason": reason, "profit": None},
                {"elasticity": None, "optimal_price": {"price": None, "reason": reason}},
            )

    async def get_status(self, dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """Get the current status of the forecasting engine, optionally scoped to a dataset."""
        is_trained = await self.forecaster.is_trained(dataset_id=dataset_id)
        
        if not is_trained:
            return {
                "model_available": False,
                "dataset_id": dataset_id,
                "trained_at": None,
                "data_points_used": None,
                "granularity": None,
                "date_range": None
            }
            
        latest_info = self.forecaster.get_latest_model_info(dataset_id=dataset_id)
        metadata = latest_info.get("metadata", {}) if latest_info else {}
        bound_dataset_id = dataset_id or metadata.get("dataset_id")
        
        return {
            "model_available": True,
            "dataset_id": bound_dataset_id,
            "trained_at": latest_info.get("created_at") if latest_info else None,
            "data_points_used": metadata.get("data_points_used"),
            "granularity": metadata.get("granularity"),
            "date_range": metadata.get("date_range")
        }
