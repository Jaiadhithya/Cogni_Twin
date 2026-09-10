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
    """Facebook Prophet implementation with exogenous regressor support and counterfactual simulation."""

    def __init__(self, storage: ModelStorage):
        self.storage = storage
        self.model = None
        self._regressor_cols: list[str] = []
        self._last_regressor_values: dict[str, float] = {}

    async def train(self, data: list[dict[str, Any]], granularity: str = "daily") -> str:
        """
        Train a Prophet model on the provided data.
        Automatically detects and registers exogenous regressors if present.
        Data should be a list of dicts with 'date', 'actual', and optionally regressor columns.
        Returns the model_id.
        """
        if len(data) < settings.FORECAST_MIN_DATA_POINTS:
            raise MlError(
                f"Insufficient data points for training. Need at least {settings.FORECAST_MIN_DATA_POINTS}."
            )

        logger.info(
            f"Training Prophet model with {len(data)} points at {granularity} granularity."
        )

        # Convert to Pandas DataFrame
        df = pd.DataFrame(data)

        # Prophet requires columns to be named 'ds' (datestamp) and 'y' (value)
        if "date" in df.columns:
            df = df.rename(columns={"date": "ds", "actual": "y"})
        # If data already has 'ds' and 'y' or 'sales_volume', handle that too
        if "sales_volume" in df.columns and "y" not in df.columns:
            df = df.rename(columns={"sales_volume": "y"})

        df["ds"] = pd.to_datetime(df["ds"])

        # Detect available regressors
        detected_regressors = [
            col for col in df.columns if col not in ["ds", "y"]
        ]
        for col in detected_regressors:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

        try:
            from prophet import Prophet

            # Configure Prophet
            self.model = Prophet(
                growth="linear",
                yearly_seasonality=True,
                weekly_seasonality=True,
                seasonality_mode="multiplicative",
                interval_width=0.80,
                mcmc_samples=0,
            )

            # Register exogenous regressors if present
            self._regressor_cols = []
            for col in detected_regressors:
                self.model.add_regressor(col)
                self._regressor_cols.append(col)
                logger.info(f"Registered exogenous regressor: {col}")

            # Fit model (Prophet uses only 'ds', 'y', and registered regressor columns)
            fit_cols = ["ds", "y"] + self._regressor_cols
            await asyncio.to_thread(self.model.fit, df[fit_cols])

            # Capture last known regressor values for simulation baseline
            if self._regressor_cols:
                last_row = df.iloc[-1]
                self._last_regressor_values = {
                    col: float(last_row[col]) for col in self._regressor_cols
                }
            else:
                self._last_regressor_values = {}

            # Save the trained model
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
            }

            self.storage.save_model(self.model, model_id, metadata)
            return model_id

        except Exception as e:
            logger.error(f"Failed to train Prophet model: {e}")
            raise MlError(f"Failed to train forecasting model: {e}")

    async def predict(self, horizon_days: int) -> list[ForecastPoint]:
        """Generate predictions using the loaded model."""
        if horizon_days > settings.FORECAST_HORIZON_MAX_DAYS:
            raise MlError(
                f"Forecast horizon exceeds maximum allowed ({settings.FORECAST_HORIZON_MAX_DAYS} days)."
            )

        if not await self.is_trained():
            raise MlError("Model has not been trained or loaded yet.")

        try:
            # Create future dataframe
            future = self.model.make_future_dataframe(periods=horizon_days, freq="D")

            # If model has regressors, populate them with last known values
            if self._regressor_cols:
                for col in self._regressor_cols:
                    baseline_val = self._last_regressor_values.get(col, 0.0)
                    future[col] = baseline_val

            # Predict
            forecast = await asyncio.to_thread(self.model.predict, future)

            # Clip negative predictions to 0 (sales cannot be negative)
            forecast["yhat"] = forecast["yhat"].clip(lower=0)
            forecast["yhat_lower"] = forecast["yhat_lower"].clip(lower=0)
            forecast["yhat_upper"] = forecast["yhat_upper"].clip(lower=0)

            # Extract just the predicted horizon
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
        mutations: dict[str, str],
        baseline_forecast: list[ForecastPoint] | None = None,
    ) -> SimulationResult:
        """
        Execute a counterfactual What-If simulation.

        1. Generates baseline forecast using current regressor values.
        2. Builds a mutated future DataFrame by applying percentage or absolute changes.
        3. Predicts on the mutated timeline.
        4. Computes delta arrays between baseline and mutated forecasts.
        """
        if not await self.is_trained():
            raise MlError("Model has not been trained or loaded yet.")

        if not self._regressor_cols:
            raise MlError(
                "Model was trained without exogenous regressors. "
                "Cannot run simulations. Retrain with multi-variate data."
            )

        # Filter mutation keys to only include valid regressors
        valid_mutations = {k: v for k, v in mutations.items() if k in self._regressor_cols}
        invalid_keys = [k for k in mutations if k not in self._regressor_cols]
        if invalid_keys:
            logger.warning(f"Ignoring unrecognized simulation levers: {invalid_keys}. Active regressors: {self._regressor_cols}")
        mutations = valid_mutations

        try:
            # Step 1: Get baseline forecast (fetch BEFORE disabling uncertainty)
            if baseline_forecast is None:
                baseline_forecast = await self.predict(horizon_days)

            # OPTIMIZATION: Disable uncertainty intervals during What-Ifs for <0.1s instantaneous re-fits
            original_uncertainty = self.model.uncertainty_samples
            self.model.uncertainty_samples = 0

            # Step 2: Build mutated future DataFrame
            future = self.model.make_future_dataframe(periods=horizon_days, freq="D")

            for col in self._regressor_cols:
                baseline_val = self._last_regressor_values.get(col, 0.0)

                if col in mutations:
                    mutation_str = mutations[col].strip()
                    mutated_val = self._apply_mutation(baseline_val, mutation_str)
                    future[col] = mutated_val
                else:
                    future[col] = baseline_val

            # Step 3: Predict on mutated timeline
            mutated_forecast_df = await asyncio.to_thread(self.model.predict, future)
            mutated_forecast_df["yhat"] = mutated_forecast_df["yhat"].clip(lower=0)
            mutated_predicted = mutated_forecast_df.tail(horizon_days)

            # Step 4: Compute deltas
            points = []
            baseline_total = 0.0
            mutated_total = 0.0

            for i, (_, mutated_row) in enumerate(mutated_predicted.iterrows()):
                b_val = baseline_forecast[i].predicted
                m_val = float(mutated_row["yhat"])

                delta = m_val - b_val
                delta_pct = (delta / b_val * 100) if b_val > 0 else 0.0

                baseline_total += b_val
                mutated_total += m_val

                points.append(
                    SimulationPoint(
                        date=mutated_row["ds"].strftime("%Y-%m-%d"),
                        baseline_predicted=round(b_val, 2),
                        mutated_predicted=round(m_val, 2),
                        delta=round(delta, 2),
                        delta_pct=round(delta_pct, 2),
                    )
                )

            total_delta = mutated_total - baseline_total
            total_delta_pct = (
                (total_delta / baseline_total * 100) if baseline_total > 0 else 0.0
            )

            self.model.uncertainty_samples = original_uncertainty

            return SimulationResult(
                mutations_applied=mutations,
                baseline_total=round(baseline_total, 2),
                mutated_total=round(mutated_total, 2),
                total_delta=round(total_delta, 2),
                total_delta_pct=round(total_delta_pct, 2),
                points=points,
                available_levers=list(self._regressor_cols),
            )

        except MlError:
            raise
        except Exception as e:
            logger.error(f"Simulation failed: {e}")
            raise MlError(f"Failed to execute simulation: {e}")

    def _apply_mutation(self, baseline: float, mutation_str: str) -> float:
        """
        Apply a mutation string to a baseline value.
        Supports: '+15%', '-10%', '+5', '-2000', '250' (absolute set).
        """
        mutation_str = mutation_str.strip()

        if mutation_str.endswith("%"):
            # Percentage change
            pct = float(mutation_str[:-1])
            return baseline * (1 + pct / 100)
        elif mutation_str.startswith("+") or mutation_str.startswith("-"):
            # Absolute delta
            delta = float(mutation_str)
            return baseline + delta
        else:
            # Absolute value set
            return float(mutation_str)

    def get_available_regressors(self) -> list[str]:
        """Return list of registered exogenous regressor column names."""
        return list(self._regressor_cols)

    async def is_trained(self) -> bool:
        """Check if a model is currently loaded in memory."""
        if self.model is not None:
            return True

        # Try to load latest model
        latest_info = self.storage.get_latest_model_info()
        if latest_info and "model_id" in latest_info:
            loaded_model = self.storage.load_model(latest_info["model_id"])
            if loaded_model:
                self.model = loaded_model
                # Restore regressor metadata
                metadata = latest_info.get("metadata", {})
                self._regressor_cols = metadata.get("regressor_columns", [])
                self._last_regressor_values = metadata.get(
                    "last_regressor_values", {}
                )
                return True

        return False

    def get_latest_model_info(self) -> dict[str, Any] | None:
        """Return the latest model metadata."""
        return self.storage.get_latest_model_info()
