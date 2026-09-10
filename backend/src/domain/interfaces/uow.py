"""Unit of Work protocol."""

from typing import Protocol
from types import TracebackType
from .repository import Repository

class UnitOfWork(Protocol):
    """Unit of Work protocol for managing database transactions."""
    
    repository: Repository

    async def __aenter__(self) -> "UnitOfWork":
        """Start a new unit of work."""
        ...

    async def __aexit__(
        self, 
        exc_type: type[BaseException] | None, 
        exc_val: BaseException | None, 
        exc_tb: TracebackType | None
    ) -> None:
        """End the unit of work, rolling back if an exception occurred."""
        ...

    async def commit(self) -> None:
        """Commit the current transaction."""
        ...

    async def rollback(self) -> None:
        """Rollback the current transaction."""
        ...
