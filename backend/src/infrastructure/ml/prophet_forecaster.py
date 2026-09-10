"""ProphetForecaster — Phase 6: Multi-variate exogenous regressor support + counterfactual simulation."""

import copy
import json
import logging
import pandas as pd
import numpy as np
from typing import Any
import asyncio

from src.domain.interfaces.forecaster import Forecaster
from src.domain.value_objects import ForecastPoint
from src.domain.value_objects.simulation_result import SimulationResult, SimulationPoint
from src.infrastructure.ml.model_storage import ModelStorage
from src.domain.exceptions import MlError
from src.config import settings

logger = logging.getLogger(__name__)

# Columns that are recognized as exogenous regressors
REGRESSOR_COLUMNS = [
    "unit_price",
    "marketing_spend",
    "supplier_lead_time_days",
    "competitor_discount_pct",
]


class ProphetForecaster(Forecaster):
    """Facebook Prophet implementation with exogenous regressor support, dataset awareness, and multi-lever simulation."""

    def __init__(self, storage: ModelStorage):
        self.storage = storage
        self.model = None
        self._regressor_cols: list[str] = []
        self._last_regressor_values: dict[str, float] = {}
        self._models: dict[str, Any] = {}
        self._model_metadata: dict[str, dict] = {}
        self._active_dataset_id: str | None = None

    async def _ensure_model_loaded(self, dataset_id: str | None = None) -> bool:
        """Ensure the appropriate Prophet model is loaded into memory."""
        ds_key = str(dataset_id) if dataset_id else None
        
        if ds_key and ds_key in self._models:
            self.model = self._models[ds_key]
            self._active_dataset_id = ds_key
            meta = self._model_metadata.get(ds_key, {})
            self._regressor_cols = meta.get("regressor_columns", [])
            self._last_regressor_values = meta.get("last_regressor_values", {})
            return True

        if ds_key:
            info = self.storage.get_latest_model_info(dataset_id=ds_key)
            if info and "model_id" in info:
                loaded = self.storage.load_model(info["model_id"])
                if loaded:
                    meta = info.get("metadata", {})
                    self.model = loaded
                    self._models[ds_key] = loaded
                    self._model_metadata[ds_key] = meta
                    self._active_dataset_id = ds_key
                    self._regressor_cols = meta.get("regressor_columns", [])
                    self._last_regressor_values = meta.get("last_regressor_values", {})
                    return True
            return False

        if self.model is not None:
            return True

        latest_info = self.storage.get_latest_model_info()
        if latest_info and "model_id" in latest_info:
            loaded_model = self.storage.load_model(latest_info["model_id"])
            if loaded_model:
                meta = latest_info.get("metadata", {})
                self.model = loaded_model
                self._regressor_cols = meta.get("regressor_columns", [])
                self._last_regressor_values = meta.get("last_regressor_values", {})
                d_id = meta.get("dataset_id")
                if d_id:
                    self._models[str(d_id)] = loaded_model
                    self._model_metadata[str(d_id)] = meta
                    self._active_dataset_id = str(d_id)
                return True
        return False

    async def train(
        self, 
        data: list[dict[str, Any]], 
        granularity: str = "daily",
        dataset_id: str | None = None
    ) -> str:
        """
        Train a Prophet model on the provided data.
        Automatically detects and registers exogenous regressors if present.
        Binds training state explicitly to dataset_id for dataset isolation.
        """
        if len(data) < settings.FORECAST_MIN_DATA_POINTS:
            raise MlError(
                f"Insufficient data points for training. Need at least {settings.FORECAST_MIN_DATA_POINTS}."
            )

        logger.info(
            f"Training Prophet model with {len(data)} points at {granularity} granularity (dataset_id={dataset_id})."
        )

        df = pd.DataFrame(data)

        if "date" in df.columns:
            df = df.rename(columns={"date": "ds", "actual": "y"})
        if "sales_volume" in df.columns and "y" not in df.columns:
            df = df.rename(columns={"sales_volume": "y"})

        df["ds"] = pd.to_datetime(df["ds"])

        detected_regressors = [
            col for col in df.columns if col not in ["ds", "y"]
        ]
        for col in detected_regressors:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

        try:
            from prophet import Prophet

            self.model = Prophet(
                growth="linear",
                yearly_seasonality=True,
                weekly_seasonality=True,
                seasonality_mode="multiplicative",
                interval_width=0.80,
                mcmc_samples=0,
            )

            self._regressor_cols = []
            for col in detected_regressors:
                self.model.add_regressor(col)
                self._regressor_cols.append(col)
                logger.info(f"Registered exogenous regressor: {col}")

            fit_cols = ["ds", "y"] + self._regressor_cols
            await asyncio.to_thread(self.model.fit, df[fit_cols])

            if self._regressor_cols:
                last_row = df.iloc[-1]
                self._last_regressor_values = {
                    col: float(last_row[col]) for col in self._regressor_cols
                }
            else:
                self._last_regressor_values = {}

            import uuid

            model_id = str(uuid.uuid4())
            metadata = {
                "granularity": granularity,
                "data_points_used": len(df),
                "date_range": {
                    "start": df["ds"].min().isoformat(),
                    "end": df["ds"].max().isoformat(),
                },
                "regressor_columns": self._regressor_cols,
                "last_regressor_values": self._last_regressor_values,
                "dataset_id": str(dataset_id) if dataset_id else None,
            }

            self.storage.save_model(self.model, model_id, metadata)
            ds_key = str(dataset_id) if dataset_id else "latest"
            self._models[ds_key] = self.model
            self._model_metadata[ds_key] = metadata
            self._active_dataset_id = ds_key
            return model_id

        except Exception as e:
            logger.error(f"Failed to train Prophet model: {e}")
            raise MlError(f"Failed to train forecasting model: {e}")

    async def predict(self, horizon_days: int, dataset_id: str | None = None) -> list[ForecastPoint]:
        """Generate predictions using the loaded model for a given dataset."""
        if horizon_days > settings.FORECAST_HORIZON_MAX_DAYS:
            raise MlError(
                f"Forecast horizon exceeds maximum allowed ({settings.FORECAST_HORIZON_MAX_DAYS} days)."
            )

        if not await self.is_trained(dataset_id=dataset_id):
            target_str = f" for dataset '{dataset_id}'" if dataset_id else ""
            raise MlError(f"Model has not been trained or loaded yet{target_str}.")

        try:
            future = self.model.make_future_dataframe(periods=horizon_days, freq="D")

            if self._regressor_cols:
                for col in self._regressor_cols:
                    baseline_val = self._last_regressor_values.get(col, 0.0)
                    future[col] = baseline_val

            forecast = await asyncio.to_thread(self.model.predict, future)

            forecast["yhat"] = forecast["yhat"].clip(lower=0)
            forecast["yhat_lower"] = forecast["yhat_lower"].clip(lower=0)
            forecast["yhat_upper"] = forecast["yhat_upper"].clip(lower=0)

            predicted_df = forecast.tail(horizon_days)

            results = []
            for _, row in predicted_df.iterrows():
                results.append(
                    ForecastPoint(
                        date=row["ds"].strftime("%Y-%m-%d"),
                        predicted=float(row["yhat"]),
                        lower_bound=float(row["yhat_lower"]),
                        upper_bound=float(row["yhat_upper"]),
                    )
                )

            return results

        except Exception as e:
            logger.error(f"Failed to generate predictions: {e}")
            raise MlError(f"Failed to generate predictions: {e}")

    async def simulate_scenario(
        self,
        horizon_days: int,
        mutations: dict[str, Any],
        baseline_forecast: list[ForecastPoint] | None = None,
        dataset_id: str | None = None,
    ) -> SimulationResult:
        """
        Execute a counterfactual multi-lever simulation tensor engine with aligned SHAP forces.

        1. Validates trained state for specific dataset_id.
        2. Normalizes compound mutations across multiple levers simultaneously.
        3. Builds mutated timeline and predicts counterfactual trajectory.
        4. Calculates mathematical delta decomposition for positive and negative economic levers.
        """
        if not await self.is_trained(dataset_id=dataset_id):
            target_str = f" for dataset '{dataset_id}'" if dataset_id else ""
            raise MlError(f"Model has not been trained or loaded yet{target_str}.")

        if not self._regressor_cols:
            raise MlError(
                "Model was trained without exogenous regressors. "
                "Cannot run simulations. Retrain with multi-variate data."
            )

        # Standardize mutations and filter to valid regressors
        valid_mutations = {}
        standardized_mutation_strs = {}
        for k, v in mutations.items():
            if k in self._regressor_cols:
                valid_mutations[k] = v
                if isinstance(v, (int, float)):
                    if -1.0 <= v <= 1.0 and v != 0:
                        standardized_mutation_strs[k] = f"{v * 100:+.1f}%"
                    else:
                        standardized_mutation_strs[k] = f"{v:+g}"
                else:
                    standardized_mutation_strs[k] = str(v).strip()

        invalid_keys = [k for k in mutations if k not in self._regressor_cols]
        if invalid_keys:
            logger.warning(f"Ignoring unrecognized simulation levers: {invalid_keys}. Active regressors: {self._regressor_cols}")

        if not valid_mutations:
            raise MlError(f"No recognized levers provided for simulation. Available levers: {self._regressor_cols}")

        try:
            original_uncertainty = self.model.uncertainty_samples
            self.model.uncertainty_samples = 0

            # Step 1: Baseline forecast
            future_base = self.model.make_future_dataframe(periods=horizon_days, freq="D")
            for col in self._regressor_cols:
                future_base[col] = self._last_regressor_values.get(col, 0.0)

            baseline_df = await asyncio.to_thread(self.model.predict, future_base)
            baseline_df["yhat"] = baseline_df["yhat"].clip(lower=0)
            baseline_tail = baseline_df.tail(horizon_days)

            # Step 2: Mutated future DataFrame with compound shocks across all mutated levers
            future_mutated = self.model.make_future_dataframe(periods=horizon_days, freq="D")
            for col in self._regressor_cols:
                b_val = self._last_regressor_values.get(col, 0.0)
                if col in valid_mutations:
                    mutated_val = self._apply_mutation(b_val, valid_mutations[col])
                    future_mutated[col] = mutated_val
                else:
                    future_mutated[col] = b_val

            # Step 3: Predict on mutated timeline
            mutated_forecast_df = await asyncio.to_thread(self.model.predict, future_mutated)
            mutated_forecast_df["yhat"] = mutated_forecast_df["yhat"].clip(lower=0)
            mutated_tail = mutated_forecast_df.tail(horizon_days)

            # Step 4: Compute day-by-day points
            points = []
            baseline_total = 0.0
            mutated_total = 0.0

            for (_, base_row), (_, mut_row) in zip(baseline_tail.iterrows(), mutated_tail.iterrows()):
                b_val = float(base_row["yhat"])
                m_val = float(mut_row["yhat"])
                delta = m_val - b_val
                delta_pct = (delta / b_val * 100.0) if b_val > 0 else 0.0

                baseline_total += b_val
                mutated_total += m_val

                points.append(
                    SimulationPoint(
                        date=base_row["ds"].strftime("%Y-%m-%d"),
                        baseline_predicted=round(b_val, 2),
                        mutated_predicted=round(m_val, 2),
                        delta=round(delta, 2),
                        delta_pct=round(delta_pct, 2),
                    )
                )

            total_delta = mutated_total - baseline_total
            total_delta_pct = (
                (total_delta / baseline_total * 100.0) if baseline_total > 0 else 0.0
            )

            # Step 5: Decompose SHAP force drivers aligned with mutations
            shap_positive_forces = []
            shap_negative_forces = []
            shap_forces = []

            for col in valid_mutations:
                mutation_repr = standardized_mutation_strs.get(col, str(valid_mutations[col]))
                
                # Check if decomposed column exists in prophet output
                if col in baseline_tail.columns and col in mutated_tail.columns:
                    base_force = float(baseline_tail[col].sum())
                    mut_force = float(mutated_tail[col].sum())
                    delta_force = mut_force - base_force
                else:
                    # Proportionate contribution fallback based on coefficient & delta
                    b_val = self._last_regressor_values.get(col, 1.0)
                    m_val = self._apply_mutation(b_val, valid_mutations[col])
                    ratio = (m_val - b_val) / (b_val if b_val != 0 else 1.0)
                    delta_force = total_delta * (ratio / (sum(abs(valid_mutations.get(c, 0)) for c in valid_mutations) or 1.0))
                    base_force = 0.0
                    mut_force = delta_force

                if abs(total_delta) > 1e-4:
                    contrib_pct = round((delta_force / abs(total_delta)) * 100.0, 2)
                else:
                    contrib_pct = 0.0

                col_lower = col.lower()
                if "price" in col_lower:
                    desc = f"Pricing mutation ({mutation_repr}) generated net {'revenue expansion' if delta_force >= 0 else 'demand contraction'} of ₹{abs(delta_force):,.2f}"
                elif any(k in col_lower for k in ["market", "spend", "ad", "budget"]):
                    desc = f"Marketing expenditure adjustment ({mutation_repr}) shifted sales trajectory by ₹{delta_force:+,.2f}"
                elif any(k in col_lower for k in ["lead", "delay", "latency", "supplier"]):
                    desc = f"Supplier latency shift ({mutation_repr}) impacted fulfillment reliability by ₹{delta_force:+,.2f}"
                elif any(k in col_lower for k in ["discount", "competitor"]):
                    desc = f"Competitive price pressure ({mutation_repr}) drove market share change of ₹{delta_force:+,.2f}"
                else:
                    desc = f"Lever '{col}' shock ({mutation_repr}) contributed ₹{delta_force:+,.2f} variance"

                direction = "Positive" if delta_force >= 0 else "Negative"
                force_entry = {
                    "feature": col,
                    "mutation": mutation_repr,
                    "baseline_impact": round(base_force, 2),
                    "mutated_impact": round(mut_force, 2),
                    "delta_force": round(delta_force, 2),
                    "contribution_pct": contrib_pct,
                    "direction": direction,
                    "description": desc,
                    "economic_narrative": desc,
                }

                if delta_force >= 0:
                    shap_positive_forces.append(force_entry)
                else:
                    shap_negative_forces.append(force_entry)
                shap_forces.append(force_entry)

            # Sort positive drivers descending, negative drivers by magnitude descending
            shap_positive_forces.sort(key=lambda x: x["delta_force"], reverse=True)
            shap_negative_forces.sort(key=lambda x: abs(x["delta_force"]), reverse=True)

            self.model.uncertainty_samples = original_uncertainty

            return SimulationResult(
                mutations_applied=standardized_mutation_strs,
                baseline_total=round(baseline_total, 2),
                mutated_total=round(mutated_total, 2),
                total_delta=round(total_delta, 2),
                total_delta_pct=round(total_delta_pct, 2),
                points=points,
                available_levers=list(self._regressor_cols),
                shap_positive_forces=shap_positive_forces,
                shap_negative_forces=shap_negative_forces,
                shap_forces=shap_forces,
                dataset_id=dataset_id,
            )

        except MlError:
            raise
        except Exception as e:
            logger.error(f"Simulation failed: {e}")
            raise MlError(f"Failed to execute simulation: {e}")

    def _apply_mutation(self, baseline: float, mutation: Any) -> float:
        """
        Apply a mutation string or numeric delta/fraction to a baseline value.
        Supports: '+15%', '-10%', 0.15, -0.10, '+5', '-2000', 250 (absolute set).
        """
        if isinstance(mutation, (int, float)):
            if -1.0 <= mutation <= 1.0 and mutation != 0:
                return baseline * (1.0 + float(mutation))
            return float(mutation)

        mutation_str = str(mutation).strip()

        if mutation_str.endswith("%"):
            pct = float(mutation_str[:-1])
            return baseline * (1.0 + pct / 100.0)
        elif mutation_str.startswith("+") or mutation_str.startswith("-"):
            delta = float(mutation_str)
            return baseline + delta
        else:
            return float(mutation_str)

    def get_available_regressors(self, dataset_id: str | None = None) -> list[str]:
        """Return list of registered exogenous regressor column names."""
        if dataset_id and str(dataset_id) in self._model_metadata:
            return list(self._model_metadata[str(dataset_id)].get("regressor_columns", []))
        return list(self._regressor_cols)

    async def is_trained(self, dataset_id: str | None = None) -> bool:
        """Check if a model is currently loaded or available in storage."""
        return await self._ensure_model_loaded(dataset_id=dataset_id)

    def get_latest_model_info(self, dataset_id: str | None = None) -> dict[str, Any] | None:
        """Return the latest model metadata, optionally scoped to dataset_id."""
        return self.storage.get_latest_model_info(dataset_id=dataset_id)
