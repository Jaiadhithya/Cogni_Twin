"""ExplainerEngine protocol."""

from typing import Protocol, Any
import pandas as pd

from src.domain.entities.shap_explanation import ShapExplanationResult

class ExplainerEngine(Protocol):
    """Abstract interface for model explainability."""

    async def compute_explanation(
        self,
        model: Any,
        forecast_df: pd.DataFrame,
        target_date: str,
        product_id: str | None = None,
        product_name: str | None = None,
    ) -> ShapExplanationResult:
        """Compute feature contribution explanations for a forecast point."""
        ...
