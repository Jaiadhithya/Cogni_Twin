"""Factor attribution engine.

Explains one day's forecast as the underlying trend level plus each factor's effect in the
target's units (₹ for revenue): day of week, time of year, every lever, and, for the
Prophet + LightGBM tier, the correction model's recent momentum. The factors add up exactly to
the forecast, so the panel can say "the forecast is ₹X because the trend level is ₹Y, weekends
add ₹Z...". Works the same for all three model tiers.
"""

import logging
from typing import Any

import pandas as pd

from src.domain.entities.shap_explanation import ShapDriver, ShapExplanationResult
from src.domain.exceptions import MlError
from src.domain.interfaces.explainer_engine import ExplainerEngine
from src.infrastructure.ml.components import MOMENTUM, MOMENTUM_LABEL, contributions

logger = logging.getLogger(__name__)


METHOD_DECOMPOSITION = "prophet_component_decomposition"
METHOD_LINEAR = "linear_coefficients"

NOTE_DECOMPOSITION = (
    "Each factor's effect in ₹ on this day's forecast, measured from the underlying trend level. "
    "The trend level plus the factors adds up to the forecast."
)
NOTE_LINEAR = (
    "Each feature's coefficient x its value in the linear model, in ₹, measured from the trend level. "
    "They add up exactly to the forecast."
)
CURRENT_NOTES = (NOTE_DECOMPOSITION, NOTE_LINEAR)

TOP_N = 3


class ShapEngine(ExplainerEngine):
    """Express one forecast day as trend level + per-factor amounts."""

    COMPONENT_LABELS: dict[str, str] = {
        "yearly": "Time of year",
        "weekly": "Day of the week",
        "monthly": "Time of month",
        "holidays": "Holiday/event impact",
        MOMENTUM: MOMENTUM_LABEL,
    }

    async def compute_explanation(
        self,
        model: Any,
        forecast_df: pd.DataFrame,
        target_date: str,
        product_id: str | None = None,
        product_name: str | None = None,
    ) -> ShapExplanationResult:
        try:
            target_dt = pd.to_datetime(target_date)
            mask = forecast_df["ds"].dt.date == target_dt.date()
            if not mask.any():
                max_date = forecast_df["ds"].max().strftime("%Y-%m-%d")
                min_date = forecast_df["ds"].min().strftime("%Y-%m-%d")
                raise MlError(
                    f"Requested explanation date '{target_date}' exceeds available forecast horizon ({min_date} to {max_date})."
                )
            idx = int(mask.to_numpy().nonzero()[0][0])
            predicted_value = float(forecast_df["yhat"].iloc[idx])
            trend_level = float(forecast_df["trend"].iloc[idx])

            amounts = {name: float(series.iloc[idx]) for name, series in contributions(model, forecast_df).items()}
            # Factors under 0.1% of the forecast are noise, not drivers worth listing.
            floor = max(0.005, 0.001 * abs(predicted_value))
            ranked = sorted(((n, v) for n, v in amounts.items() if abs(v) >= floor), key=lambda kv: abs(kv[1]), reverse=True)

            positive, negative = [], []
            for name, value in ranked:
                driver = ShapDriver(
                    feature=name,
                    contribution=round(value, 2),
                    description=self.COMPONENT_LABELS.get(name, name.replace("_", " ").capitalize()),
                )
                (positive if value > 0 else negative).append(driver)

            linear = getattr(model, "tier", None) == "linear"
            return ShapExplanationResult(
                product_id=product_id,
                product_name=product_name,
                forecast_date=target_date,
                predicted_value=round(predicted_value, 2),
                top_positive_drivers=positive[:TOP_N],
                top_negative_drivers=negative[:TOP_N],
                explanation_text=None,
                method=METHOD_LINEAR if linear else METHOD_DECOMPOSITION,
                method_note=NOTE_LINEAR if linear else NOTE_DECOMPOSITION,
                base_value=round(trend_level, 2),
            )
        except MlError:
            raise
        except Exception as e:
            logger.error(f"Factor attribution failed: {e}")
            raise MlError(f"Failed to compute factor attribution: {e}") from e
