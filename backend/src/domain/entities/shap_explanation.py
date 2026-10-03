"""Factor-attribution explanation domain entities."""

from dataclasses import dataclass

@dataclass
class ShapDriver:
    feature: str        # e.g., "weekly", "trend", "yearly"
    contribution: float # Positive = upward push, Negative = downward
    description: str    # Human-readable label


@dataclass
class ShapExplanationResult:
    product_id: str | None
    product_name: str | None
    forecast_date: str
    predicted_value: float
    top_positive_drivers: list[ShapDriver]
    top_negative_drivers: list[ShapDriver]
    explanation_text: str | None  # Filled later by LLM
    method: str = "prophet_component_decomposition"  # how the contributions were computed
    method_note: str | None = None
    base_value: float | None = None  # the forecast before the attributed drivers, when meaningful
