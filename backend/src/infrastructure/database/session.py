"""Database session management."""

from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.infrastructure.database.engine import engine, readonly_engine

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

ReadOnlySessionLocal = async_sessionmaker(
    bind=readonly_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing a database session."""
    async with AsyncSessionLocal() as session:
        yield session
