"""Pagination value objects."""

from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class PaginationParams:
    """Pagination parameters."""
    page: int = 1
    page_size: int = 50
    
    def __post_init__(self):
        if self.page < 1:
            object.__setattr__(self, 'page', 1)
        if self.page_size < 1:
            object.__setattr__(self, 'page_size', 1)
        if self.page_size > 100:
            object.__setattr__(self, 'page_size', 100)

@dataclass(frozen=True)
class PaginatedResult(Generic[T]):
    """Paginated result set."""
    items: list[T]
    total_count: int
    page: int
    page_size: int
    total_pages: int
