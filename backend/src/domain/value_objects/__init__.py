"""Immutable value types."""

from .date_range import DateRange
from .pagination import PaginationParams, PaginatedResult
from .forecast_result import ForecastPoint
from .ingestion_result import IngestionResult
from .entity_type import EntityType
from .simulation_result import SimulationResult, SimulationPoint

__all__ = [
    "DateRange",
    "PaginationParams",
    "PaginatedResult",
    "ForecastPoint",
    "IngestionResult",
    "EntityType",
    "SimulationResult",
    "SimulationPoint",
]
