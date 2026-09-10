"""Forecaster protocol — Phase 6: Extended with simulation and regressor support."""

from typing import Protocol, Any
from src.domain.value_objects import ForecastPoint
from src.domain.value_objects.simulation_result import SimulationResult


class Forecaster(Protocol):
    """Forecasting engine protocol."""

    async def train(self, data: list[dict[str, Any]], granularity: str = "daily") -> str:
        ...

    async def predict(self, horizon_days: int) -> list[ForecastPoint]:
        ...

    async def simulate_scenario(
        self,
        horizon_days: int,
        mutations: dict[str, str],
        baseline_forecast: list[ForecastPoint] | None = None,
    ) -> SimulationResult:
        """Execute a counterfactual What-If simulation with mutated regressors."""
        ...

    async def is_trained(self) -> bool:
        ...

    def get_latest_model_info(self) -> dict[str, Any] | None:
        ...

    def get_available_regressors(self) -> list[str]:
        """Return list of registered exogenous regressor column names."""
        ...
