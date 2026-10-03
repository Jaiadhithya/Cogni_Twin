"""SQLAlchemy Unit of Work implementation."""

from types import TracebackType
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.interfaces.uow import UnitOfWork
from src.infrastructure.database.repository import PostgresRepository
from src.infrastructure.database.session import ReadOnlySessionLocal

class SqlAlchemyUnitOfWork(UnitOfWork):
    """SQLAlchemy implementation of the Unit of Work protocol."""
    
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], readonly_session_factory: async_sessionmaker[AsyncSession] | None = None):
        self._session_factory = session_factory
        self._readonly_session_factory = readonly_session_factory or ReadOnlySessionLocal
        self._session = None
        self._repository = None
        # A request shares one UoW across several services, and a service may call
        # another while it still holds the UoW open. Each entry therefore keeps its
        # own session on a stack so an inner exit cannot orphan the outer session.
        self._outer: list[tuple[AsyncSession | None, PostgresRepository | None]] = []

    @property
    def repository(self) -> PostgresRepository:
        """Get the repository instance."""
        if not self._repository:
            raise RuntimeError("UnitOfWork is not initialized. Use it within an async context manager.")
        return self._repository

    async def __aenter__(self) -> "SqlAlchemyUnitOfWork":
        """Start a new transaction."""
        self._outer.append((self._session, self._repository))
        self._session = self._session_factory()
        self._repository = PostgresRepository(self._session, self._readonly_session_factory)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None
    ) -> None:
        """End the transaction. Roll back if an exception occurred."""
        session = self._session
        try:
            if exc_type is not None:
                await self.rollback()
            else:
                await self.commit()
        finally:
            try:
                await session.close()
            finally:
                outer_session, outer_repository = self._outer.pop()
                if outer_session is not None:
                    self._session, self._repository = outer_session, outer_repository

    async def commit(self) -> None:
        """Commit the transaction."""
        if self._session:
            await self._session.commit()

    async def rollback(self) -> None:
        """Rollback the transaction."""
        if self._session:
            await self._session.rollback()
