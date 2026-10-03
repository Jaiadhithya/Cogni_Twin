import logging
from typing import Dict, Any, List, Optional
from dataclasses import asdict

from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.forecaster import Forecaster
from src.domain.exceptions import MlError
from src.domain.value_objects import DateRange

logger = logging.getLogger(__name__)

class ForecastService:
    """Service for orchestrating forecasting tasks with dataset awareness and multi-lever simulation."""

    def __init__(self, uow: UnitOfWork, forecaster: Forecaster):
        self.uow = uow
        self.forecaster = forecaster

    async def _extract_series(self, dataset_id: Optional[str] = None) -> tuple[list[dict], str]:
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

        return data, active_dataset_id

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

    async def simulate(self, horizon_days: int, mutations: Dict[str, Any], dataset_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute a counterfactual What-If simulation with mutated regressors and aligned lever contributions.
        """
        is_trained = await self.forecaster.is_trained(dataset_id=dataset_id)
        if not is_trained:
            target_str = f" for dataset '{dataset_id}'" if dataset_id else ""
            raise MlError(f"No trained forecasting model is available{target_str}. Please train a model first.")

        result = await self.forecaster.simulate_scenario(
            horizon_days=horizon_days,
            mutations=mutations,
            dataset_id=dataset_id
        )

        resp = asdict(result)
        resp["dataset_id"] = dataset_id

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
