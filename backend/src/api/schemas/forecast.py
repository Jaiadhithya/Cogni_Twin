from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import date

# --- Existing Schemas (unchanged) ---

class ForecastTrainRequest(BaseModel):
    granularity: Literal["daily", "weekly", "monthly"] = "daily"

class ForecastTrainResponseData(BaseModel):
    message: str
    training_id: str
    data_points_used: int
    date_range: dict[str, str]
    estimated_time_seconds: int

class ModelInfo(BaseModel):
    trained_at: str
    data_points_used: int
    granularity: str

class HistoryPoint(BaseModel):
    date: str
    actual: float

class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower_bound: float
    upper_bound: float

class ForecastPredictResponseData(BaseModel):
    model_info: ModelInfo
    history: list[HistoryPoint]
    forecast: list[ForecastPoint]

class ForecastStatusResponseData(BaseModel):
    model_available: bool
    trained_at: Optional[str] = None
    data_points_used: Optional[int] = None
    granularity: Optional[str] = None
    date_range: Optional[dict[str, str]] = None

# --- NEW Phase 6: Simulation Schemas ---

class SimulationRequest(BaseModel):
    """Request body for counterfactual What-If simulation."""
    horizon_days: int = Field(default=30, ge=7, le=90, description="Forecast horizon in days")
    mutations: dict[str, str] = Field(
        ...,
        description='Lever mutations. Use percentage ("+15%") or absolute ("+5") notation.',
        json_schema_extra={"examples": [{"unit_price": "+15%", "marketing_spend": "+50000"}]}
    )

class SimulationPointSchema(BaseModel):
    """A single simulation comparison point."""
    date: str
    baseline_predicted: float
    mutated_predicted: float
    delta: float
    delta_pct: float

class SimulationResponseData(BaseModel):
    """Response data for a counterfactual simulation."""
    mutations_applied: dict[str, str]
    baseline_total: float
    mutated_total: float
    total_delta: float
    total_delta_pct: float
    points: list[SimulationPointSchema]
    available_levers: list[str]
    shap_positive_forces: list[dict] = Field(default_factory=list)
    shap_negative_forces: list[dict] = Field(default_factory=list)
