from typing import Optional, Literal, Any
from pydantic import BaseModel, Field
from datetime import date

# --- Existing Schemas ---

class ForecastTrainRequest(BaseModel):
    granularity: Literal["daily", "weekly", "monthly"] = "daily"
    dataset_id: Optional[str] = None

class TrainingJobData(BaseModel):
    """State of a background training job."""
    job_id: str
    dataset_id: Optional[str] = None
    granularity: str
    status: Literal["queued", "running", "succeeded", "failed"]
    error: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    metrics: Optional[dict[str, Any]] = None

class ForecastTrainResponseData(BaseModel):
    job_id: Optional[str] = None
    message: str
    training_id: str
    dataset_id: Optional[str] = None
    data_points_used: int
    date_range: dict[str, str]
    estimated_time_seconds: int

class ModelInfo(BaseModel):
    trained_at: Optional[str] = None
    data_points_used: int
    granularity: str
    dataset_id: Optional[str] = None

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
    dataset_id: Optional[str] = None
    history: list[HistoryPoint]
    forecast: list[ForecastPoint]

class ForecastStatusResponseData(BaseModel):
    model_available: bool
    dataset_id: Optional[str] = None
    trained_at: Optional[str] = None
    data_points_used: Optional[int] = None
    granularity: Optional[str] = None
    date_range: Optional[dict[str, str]] = None

class BacktestResponseData(BaseModel):
    """Held-out evaluation of the forecasting model (MAE/MAPE/RMSE)."""
    dataset_id: Optional[str] = None
    data_points_used: int
    test_days: int
    train_points: int
    mae: float
    rmse: float
    mape: Optional[float] = None
    test_start: str
    test_end: str

# --- Simulation Schemas ---

class SimulationRequest(BaseModel):
    """Request body for counterfactual What-If simulation."""
    dataset_id: Optional[str] = None
    horizon_days: int = Field(default=30, ge=7, le=90, description="Forecast horizon in days")
    mutations: dict[str, Any] = Field(
        ...,
        description='Lever mutations. Use percentage ("+15%"), absolute delta ("+5"), or fractional (0.15).',
        json_schema_extra={"examples": [{"unit_price": "+15%", "marketing_spend": "-10%"}]}
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
    dataset_id: Optional[str] = None
    mutations_applied: dict[str, str]
    baseline_total: float
    mutated_total: float
    total_delta: float
    total_delta_pct: float
    points: list[SimulationPointSchema]
    available_levers: list[str]
    shap_forces: list[dict] = Field(default_factory=list)
    shap_positive_forces: list[dict] = Field(default_factory=list)
    shap_negative_forces: list[dict] = Field(default_factory=list)
