"""Database engine configuration."""

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from src.config import settings

import os
import sys
from sqlalchemy.pool import NullPool

def get_engine() -> AsyncEngine:
    """Create and return the SQLAlchemy async engine."""
    if os.getenv("TESTING", "").lower() in ("true", "1") or "pytest" in sys.modules:
        return create_async_engine(
            settings.DATABASE_URL,
            poolclass=NullPool,
            echo=(settings.LOG_LEVEL == "DEBUG"),
        )
    return create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        echo=(settings.LOG_LEVEL == "DEBUG"),
    )

engine = get_engine()
