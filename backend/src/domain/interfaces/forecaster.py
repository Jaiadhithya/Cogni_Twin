"""Forecaster protocol — Phase 6: Extended with simulation and regressor support."""

from typing import Protocol, Any
from src.domain.value_objects import ForecastPoint
from src.domain.value_objects.simulation_result import SimulationResult


class Forecaster(Protocol):
    """Forecasting engine protocol with dataset-aware execution and multi-lever simulation."""

    async def train(
        self, 
        data: list[dict[str, Any]], 
        granularity: str = "daily", 
        dataset_id: str | None = None
    ) -> str:
        ...

    async def predict(
        self, 
        horizon_days: int, 
        dataset_id: str | None = None
    ) -> list[ForecastPoint]:
        ...

    async def simulate_scenario(
        self,
        horizon_days: int,
        mutations: dict[str, Any],
        baseline_forecast: list[ForecastPoint] | None = None,
        dataset_id: str | None = None,
    ) -> SimulationResult:
        """Execute a counterfactual What-If simulation with mutated regressors."""
        ...

    async def is_trained(self, dataset_id: str | None = None) -> bool:
        ...

    def get_latest_model_info(self, dataset_id: str | None = None) -> dict[str, Any] | None:
        ...

    def get_available_regressors(self, dataset_id: str | None = None) -> list[str]:
        """Return list of registered exogenous regressor column names."""
        ...
