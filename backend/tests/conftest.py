"""Pytest configuration and global fixtures."""

import pytest
import os
import sys
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.config import settings

# Ensure TESTING environment variable is set
os.environ["TESTING"] = "true"

@pytest.fixture(scope="session")
def test_engine():
    """Create a NullPool engine for concurrency safety in test runs."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    yield engine
    engine.sync_engine.dispose()
