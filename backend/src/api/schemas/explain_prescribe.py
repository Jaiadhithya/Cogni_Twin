"""Schemas for the unified Explain + Prescribe endpoint."""

from typing import Optional, List
from pydantic import BaseModel, Field


class ShapDriverPayload(BaseModel):
    """A single factor-attribution driver contribution."""
    feature: str
    contribution: float
    description: str


class ShapDriversPayload(BaseModel):
    """Grouped positive and negative attribution drivers."""
    positive: List[ShapDriverPayload]
    negative: List[ShapDriverPayload]


class PrescriptiveAction(BaseModel):
    """A single prioritized prescriptive action."""
    priority: int = Field(ge=1, le=3)
    action: str
    expected_impact: str
    timeframe: str


class ForecastPointSchema(BaseModel):
    """A forecast point for the explain-prescribe response."""
    date: str
    predicted: float
    lower_bound: float
    upper_bound: float


class ExplainPrescribeResponseData(BaseModel):
    """Unified response combining forecast, factor attribution, anomaly detection, and prescriptive actions."""
    forecast_points: List[ForecastPointSchema]
    shap_drivers: ShapDriversPayload
    anomaly_detected: bool
    anomaly_description: Optional[str] = None
    prescriptive_actions: List[PrescriptiveAction]
    executive_summary: str
