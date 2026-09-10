"""Forecast result value object."""

from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class ForecastPoint:
    """A single forecasted point."""
    date: date
    predicted: float
    lower_bound: float
    upper_bound: float
