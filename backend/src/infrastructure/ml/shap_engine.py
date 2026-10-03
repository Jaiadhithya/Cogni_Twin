"""Factor attribution engine.

Three methods, chosen by the model tier that produced the forecast:

* ``tree_shap``                        - Shapley values (``shap.TreeExplainer``) of the LightGBM
                                         residual stage of the Prophet + LightGBM tier.
* ``linear_coefficients``              - coefficient x feature contributions of the linear tier.
* ``prophet_component_decomposition``  - Prophet's components as a share of the forecast; this is
                                         NOT Shapley values.
"""

import logging
from typing import Any
import numpy as np
import pandas as pd

from src.domain.interfaces.explainer_engine import ExplainerEngine
from src.domain.exceptions import MlError
from src.domain.entities.shap_explanation import ShapDriver, ShapExplanationResult

logger = logging.getLogger(__name__)


METHOD_DECOMPOSITION = "prophet_component_decomposition"
METHOD_LINEAR = "linear_coefficients"
METHOD_TREE_SHAP = "tree_shap"

NOTE_DECOMPOSITION = (
    "Contributions are each forecast component's share of the predicted value. "
    "With multiplicative seasonality the percentages are approximate."
)
NOTE_LINEAR = (
    "Contributions are each feature's coefficient x its standardized value in the linear model; "
    "they add up exactly to the forecast."
)
NOTE_TREE_SHAP = (
    "Exact Shapley values (TreeSHAP) of the LightGBM stage that corrects Prophet's forecast; they explain "
    "that correction, shown as a percentage of the predicted value. `base_value` is Prophet's forecast "
    "plus the correction's average."
)

STAGE2_LABELS = {
    "log_price": "Pricing level",
    "resid_lag_1": "Yesterday's unexplained demand",
    "resid_lag_7": "Unexplained demand one week ago",
    "resid_lag_30": "Unexplained demand 30 days ago",
    "resid_roll_mean_7": "Recent 7-day unexplained trend",
    "resid_roll_mean_28": "Recent 28-day unexplained trend",
    "dow": "Day-of-week effect not captured by seasonality",
}


class ShapEngine(ExplainerEngine):
    """
    Express Prophet's forecast components as percentage-of-forecast contributions.

    This is a component decomposition, not Shapley values. With multiplicative
    seasonality the percentages are approximate, because components scale one
    another rather than adding up exactly.

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
            tier = getattr(model, "tier", "prophet")
            if tier == "prophet_lgbm":
                return self._tree_shap(model, forecast_df, int(np.flatnonzero(mask.to_numpy())[0]), predicted_value, target_date, product_id, product_name)

            # Dynamically determine columns to consider (trend, seasonality, and all regressors)
            ignore_cols = {"ds", "yhat", "lgbm_residual", "additive_terms", "multiplicative_terms", "extra_regressors_additive", "extra_regressors_multiplicative"}
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
                method=METHOD_LINEAR if tier == "linear" else METHOD_DECOMPOSITION,
                method_note=NOTE_LINEAR if tier == "linear" else NOTE_DECOMPOSITION,
            )
        except MlError:
            raise
        except Exception as e:
            logger.error(f"Factor attribution failed: {e}")
            raise MlError(f"Failed to compute factor attribution: {e}") from e

    def _tree_shap(
        self,
        model: Any,
        forecast_df: pd.DataFrame,
        row_index: int,
        predicted_value: float,
        target_date: str,
        product_id: str | None,
        product_name: str | None,
    ) -> ShapExplanationResult:
        import shap

        features = forecast_df.attrs.get("stage2_features")
        if features is None or features.iloc[row_index].isna().all():
            raise MlError(
                f"No residual-stage features for '{target_date}'; TreeSHAP covers forecast days after the training window."
            )
        x = features.iloc[[row_index]].to_numpy(dtype=float)
        explainer = shap.TreeExplainer(model.booster)
        values = np.ravel(explainer.shap_values(x))
        expected = float(np.ravel(explainer.expected_value)[0])

        residual_pred = float(forecast_df["lgbm_residual"].iloc[row_index])
        stage1 = predicted_value - residual_pred
        base_val = abs(predicted_value) if abs(predicted_value) > 1e-6 else 1.0

        positive, negative = [], []
        for name, value in sorted(zip(model.feature_names, values), key=lambda kv: abs(kv[1]), reverse=True):
            if abs(value) < 1e-9:
                continue
            driver = ShapDriver(
                feature=name,
                contribution=round(float(value) / base_val * 100.0, 4),
                description=STAGE2_LABELS.get(name, self.COMPONENT_LABELS.get(name, name.replace("_", " ").title())),
            )
            (positive if value > 0 else negative).append(driver)

        return ShapExplanationResult(
            product_id=product_id,
            product_name=product_name,
            forecast_date=target_date,
            predicted_value=round(predicted_value, 2),
            top_positive_drivers=positive[:3],
            top_negative_drivers=negative[:3],
            explanation_text=None,
            method=METHOD_TREE_SHAP,
            method_note=NOTE_TREE_SHAP,
            base_value=round(stage1 + expected, 2),
        )
