import logging
from typing import Dict, Any, List

from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.forecaster import Forecaster
from src.domain.exceptions import MlError
from src.domain.value_objects import DateRange

logger = logging.getLogger(__name__)

class ForecastService:
    """Service for orchestrating forecasting tasks — Phase 6: simulation support."""

    def __init__(self, uow: UnitOfWork, forecaster: Forecaster):
        self.uow = uow
        self.forecaster = forecaster

    async def train_model(self, granularity: str = "daily") -> Dict[str, Any]:
        """
        Extract historical sales data, train a new model, and return status.
        Phase 6: Passes regressor columns if available in the data.
        """
        logger.info(f"Initiating model training with {granularity} granularity.")
        
        async with self.uow as uow:
            from sqlalchemy import select, text
            from src.infrastructure.database.models import DatasetMetadata
            
            query = select(DatasetMetadata).order_by(DatasetMetadata.upload_date.desc()).limit(1)
            result = await uow.repository.session.execute(query)
            dataset = result.scalar_one_or_none()
            
            if not dataset:
                raise MlError("No datasets available for training.")
                
            table = dataset.generated_table_name
            mapping = dataset.column_mapping or {}
            
            target_metric = mapping.get("target_metric")
            primary_date = mapping.get("primary_date")
            
            if not target_metric or not primary_date:
                # Fallback to defaults
                target_metric = target_metric or "units_sold"
                primary_date = primary_date or "date"
                
            # Detect available regressor columns from the table
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
        
        # Train model
        model_id = await self.forecaster.train(data, granularity=granularity)
        
        return {
            "message": "Model trained successfully",
            "training_id": model_id,
            "data_points_used": len(data),
            "date_range": {
                "start": data[0]["date"],
                "end": data[-1]["date"]
            },
            "estimated_time_seconds": 0
        }

    async def get_forecast(self, horizon_days: int = 30) -> Dict[str, Any]:
        """Get history and future predictions."""
        is_trained = await self.forecaster.is_trained()
        if not is_trained:
            raise MlError("No trained forecasting model is available. Please train a model first.")
            
        forecast = await self.forecaster.predict(horizon_days=horizon_days)
        
        latest_info = self.forecaster.get_latest_model_info()
        granularity = latest_info.get("metadata", {}).get("granularity", "daily") if latest_info else "daily"
        
        async with self.uow as uow:
            metrics = await uow.repository.get_summary_metrics()
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
                "granularity": granularity
            },
            "history": history,
            "forecast": forecast_points
        }

    async def simulate(self, horizon_days: int, mutations: Dict[str, str]) -> Dict[str, Any]:
        """
        Phase 6: Execute a counterfactual simulation with mutated regressors.
        """
        is_trained = await self.forecaster.is_trained()
        if not is_trained:
            raise MlError("No trained forecasting model is available.")

        result = await self.forecaster.simulate_scenario(
            horizon_days=horizon_days,
            mutations=mutations
        )

        # Convert dataclass to dict
        from dataclasses import asdict
        resp = asdict(result)

        resp["shap_positive_forces"] = []
        resp["shap_negative_forces"] = []

        try:
            from src.infrastructure.ml.shap_engine import ShapEngine
            import asyncio

            model = getattr(self.forecaster, "model", None)
            if model:
                shap_engine = ShapEngine()
                
                # Disable uncertainty for fast predict
                original_uncertainty = getattr(model, 'uncertainty_samples', None)
                model.uncertainty_samples = 0
                
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
                        
                forecast_df = await asyncio.to_thread(model.predict, future)
                
                if original_uncertainty is not None:
                    model.uncertainty_samples = original_uncertainty
                    
                target_date = forecast_df["ds"].iloc[-1].strftime("%Y-%m-%d")
                
                explanation = await shap_engine.compute_explanation(
                    model=model,
                    forecast_df=forecast_df,
                    target_date=target_date
                )
                
                resp["shap_positive_forces"] = [asdict(d) for d in explanation.top_positive_drivers]
                resp["shap_negative_forces"] = [asdict(d) for d in explanation.top_negative_drivers]
        except Exception as e:
            logger.error(f"Failed to calculate SHAP for simulation: {e}")

        return resp

    async def get_status(self) -> Dict[str, Any]:
        """Get the current status of the forecasting engine."""
        is_trained = await self.forecaster.is_trained()
        
        if not is_trained:
            return {
                "model_available": False,
                "trained_at": None,
                "data_points_used": None,
                "granularity": None,
                "date_range": None
            }
            
        latest_info = self.forecaster.get_latest_model_info()
        metadata = latest_info.get("metadata", {}) if latest_info else {}
        
        return {
            "model_available": True,
            "trained_at": latest_info.get("created_at") if latest_info else None,
            "data_points_used": metadata.get("data_points_used"),
            "granularity": metadata.get("granularity"),
            "date_range": metadata.get("date_range")
        }
