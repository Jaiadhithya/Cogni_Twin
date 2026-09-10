"""SHAP explainability engine — Phase 6: Exogenous regressor decomposition."""

import logging
from typing import Any
import pandas as pd

from src.domain.interfaces.explainer_engine import ExplainerEngine
from src.domain.exceptions import MlError
from src.domain.entities.shap_explanation import ShapDriver, ShapExplanationResult

logger = logging.getLogger(__name__)


class ShapEngine(ExplainerEngine):
    """
    Extract Prophet forecast decomposition as SHAP-style feature contributions.

    Phase 6 upgrade: Now decomposes exogenous regressor contributions
    (unit_price, marketing_spend, supplier_lead_time_days, competitor_discount_pct)
    alongside native Prophet components (trend, yearly, weekly, holidays).
    """

    COMPONENT_LABELS: dict[str, str] = {
        # Native Prophet components
        "trend": "Long-term business trajectory",
        "yearly": "Yearly seasonal pattern",
        "weekly": "Day-of-week effect",
        "holidays": "Holiday/event impact",
        "additive_terms": "Additional factors",
        "multiplicative_terms": "Scaling factors",
        # Phase 6: Exogenous regressors
        "unit_price": "Pricing lever impact",
        "marketing_spend": "Marketing investment return",
        "supplier_lead_time_days": "Supply chain efficiency",
        "competitor_discount_pct": "Competitive pricing pressure",
    }

    # Base native Prophet components
    BASE_DECOMPOSITION_COLS = [
        "trend",
        "yearly",
        "weekly",
        "holidays",
    ]

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
            if mask.any():
                row = forecast_df[mask].iloc[0]
            else:
                max_date = forecast_df["ds"].max().strftime("%Y-%m-%d")
                min_date = forecast_df["ds"].min().strftime("%Y-%m-%d")
                raise MlError(
                    f"Requested explanation date '{target_date}' exceeds available forecast horizon ({min_date} to {max_date})."
                )

            predicted_value = float(row["yhat"])

            # Dynamically determine columns to consider (trend, seasonality, and all regressors)
            ignore_cols = {"ds", "yhat", "additive_terms", "multiplicative_terms", "extra_regressors_additive", "extra_regressors_multiplicative"}
            dynamic_cols = [
                c for c in forecast_df.columns 
                if c not in ignore_cols and not c.endswith("_lower") and not c.endswith("_upper")
            ]

            components = {}
            for col in dynamic_cols:
                val = float(row[col])
                if abs(val) > 1e-6:
                    components[col] = val

            sorted_comp = sorted(
                components.items(), key=lambda x: abs(x[1]), reverse=True
            )

            positive, negative = [], []
            base_val = abs(predicted_value) if abs(predicted_value) > 1e-6 else 1.0

            for feat, contrib in sorted_comp:
                pct_contrib = (contrib / base_val) * 100.0
                d = ShapDriver(
                    feature=feat,
                    contribution=round(pct_contrib, 4),
                    description=self.COMPONENT_LABELS.get(feat, feat.replace("_", " ").title()),
                )
                (positive if contrib > 0 else negative).append(d)

            return ShapExplanationResult(
                product_id=product_id,
                product_name=product_name,
                forecast_date=target_date,
                predicted_value=round(predicted_value, 2),
                top_positive_drivers=positive[:3],
                top_negative_drivers=negative[:3],
                explanation_text=None,
            )
        except MlError:
            raise
        except Exception as e:
            logger.error(f"SHAP computation failed: {e}")
            raise MlError(f"Failed to compute SHAP explanation: {e}") from e
