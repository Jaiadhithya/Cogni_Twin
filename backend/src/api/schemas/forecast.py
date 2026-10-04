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
    # Numeric columns not used as levers, with the reason (outcomes such as units sold or profit).
    excluded_regressors: dict[str, str] = {}

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
    model_tier: Optional[str] = Field(default=None, description="linear | prophet | prophet_lgbm")

class BacktestResponseData(BaseModel):
    """Held-out evaluation of the forecasting model (MAE/MAPE/RMSE)."""
    dataset_id: Optional[str] = None
    data_points_used: int
    test_days: int
    train_points: int
    mae: float
    rmse: float
    mape: Optional[float] = Field(default=None, description="Mean absolute percentage error in percent units (12.5 means 12.5%).")
    model_tier: Optional[str] = Field(default=None, description="Tier of the model that was backtested.")
    test_start: str
    test_end: str

# --- Simulation Schemas ---

class SimulationRequest(BaseModel):
    """Request body for counterfactual What-If simulation."""
    dataset_id: Optional[str] = None
    horizon_days: int = Field(default=30, ge=7, le=90, description="Forecast horizon in days")
    unit_cost: Optional[float] = Field(
        default=None, ge=0,
        description="Per-unit cost used for gross profit when the dataset has no cost column (overrides a cost column if both exist).",
    )
    save: bool = Field(default=False, description="Persist this scenario so it can be listed and compared later.")
    name: Optional[str] = Field(default=None, max_length=255, description="Optional label for a saved scenario.")
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
    run_id: Optional[str] = Field(default=None, description="Id of the saved scenario when the request set save=true.")
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
    uncertainty: Optional[dict[str, Any]] = Field(
        default=None,
        description="Prediction intervals for baseline and scenario, per day aligned with `points`, and the method used.",
    )
    profit: Optional[dict[str, Any]] = Field(
        default=None,
        description="Gross profit for baseline vs scenario, or {available: false, reason} when cost data is missing.",
    )
    pricing: Optional[dict[str, Any]] = Field(
        default=None,
        description="Estimated price elasticity and profit-maximising price (null price + reason when not reliable).",
    )


class SavedSimulationData(BaseModel):
    """A saved what-if scenario."""
    id: str
    dataset_id: Optional[str] = None
    name: Optional[str] = None
    mutations: dict[str, Any]
    horizon_days: int
    baseline_summary: dict[str, Any]
    simulated_summary: dict[str, Any]
    delta_metrics: dict[str, Any]
    created_at: Optional[str] = None

class SavedSimulationListData(BaseModel):
    records: list[SavedSimulationData]

class SimulationComparisonMetric(BaseModel):
    metric: str
    values: list[Optional[float]] = Field(description="One value per run, in run_ids order.")

class SimulationComparisonData(BaseModel):
    run_ids: list[str]
    runs: list[dict[str, Any]]
    metrics: list[SimulationComparisonMetric]
