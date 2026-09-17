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

def get_readonly_engine() -> AsyncEngine:
    """Create and return the read-only SQLAlchemy async engine.

    Bound to ``DATABASE_READONLY_URL``, which must point at a role with only
    ``SELECT`` privileges so that even a validation bypass cannot mutate data.
    """
    if os.getenv("TESTING", "").lower() in ("true", "1") or "pytest" in sys.modules:
        return create_async_engine(
            settings.DATABASE_READONLY_URL,
            poolclass=NullPool,
            echo=(settings.LOG_LEVEL == "DEBUG"),
        )
    return create_async_engine(
        settings.DATABASE_READONLY_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        echo=(settings.LOG_LEVEL == "DEBUG"),
    )

engine = get_engine()
readonly_engine = get_readonly_engine()
