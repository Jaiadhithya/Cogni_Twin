"""Simulation result value objects for counterfactual What-If scenarios."""

from dataclasses import dataclass, field

@dataclass(frozen=True)
class SimulationPoint:
    """A single point comparing baseline vs. mutated forecast."""
    date: str
    baseline_predicted: float
    mutated_predicted: float
    delta: float
    delta_pct: float

@dataclass(frozen=True)
class SimulationResult:
    """Complete result of a counterfactual simulation."""
    mutations_applied: dict[str, str]
    baseline_total: float
    mutated_total: float
    total_delta: float
    total_delta_pct: float
    points: list[SimulationPoint]
    available_levers: list[str]
    shap_positive_forces: list[dict] = field(default_factory=list)
    shap_negative_forces: list[dict] = field(default_factory=list)
    shap_forces: list[dict] = field(default_factory=list)
    dataset_id: str | None = None
    # Per-day lever values over the horizon (baseline / scenario), used to price the scenario.
    baseline_regressors: dict[str, list[float]] = field(default_factory=dict)
    mutated_regressors: dict[str, list[float]] = field(default_factory=dict)
    # Prophet's own 80% bounds per day; filled only when the caller asks for them.
    baseline_prophet_interval: dict[str, list[float]] | None = None
    mutated_prophet_interval: dict[str, list[float]] | None = None
