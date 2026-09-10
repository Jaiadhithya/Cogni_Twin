"""Date range value object."""

from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class DateRange:
    """Date range filter."""
    start_date: date | None = None
    end_date: date | None = None
