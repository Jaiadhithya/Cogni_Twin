"""SQLAlchemy Unit of Work implementation."""

from types import TracebackType
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.interfaces.uow import UnitOfWork
from src.infrastructure.database.repository import PostgresRepository

class SqlAlchemyUnitOfWork(UnitOfWork):
    """SQLAlchemy implementation of the UnitOfWork protocol."""
    
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory
        self._session = None
        self._repository = None

    @property
    def repository(self) -> PostgresRepository:
        """Get the repository instance."""
        if not self._repository:
            raise RuntimeError("UnitOfWork is not initialized. Use it within an async context manager.")
        return self._repository

    async def __aenter__(self) -> "SqlAlchemyUnitOfWork":
        """Start a new transaction."""
        self._session = self._session_factory()
        self._repository = PostgresRepository(self._session)
        return self

    async def __aexit__(
        self, 
        exc_type: type[BaseException] | None, 
        exc_val: BaseException | None, 
        exc_tb: TracebackType | None
    ) -> None:
        """End the transaction. Roll back if an exception occurred."""
        try:
            if exc_type is not None:
                await self.rollback()
            else:
                await self.commit()
        finally:
            await self._session.close()

    async def commit(self) -> None:
        """Commit the transaction."""
        if self._session:
            await self._session.commit()

    async def rollback(self) -> None:
        """Rollback the transaction."""
        if self._session:
            await self._session.rollback()
