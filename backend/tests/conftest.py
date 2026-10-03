"""Pytest configuration and global fixtures."""

import pytest
import os
import re
import socket
import sys
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.config import settings

# Ensure TESTING environment variable is set
os.environ["TESTING"] = "true"

from fastapi.testclient import TestClient  # noqa: E402
from src.main import app  # noqa: E402
from src.dependencies import get_vector_store  # noqa: E402
from tests.helpers import InMemoryVectorStore, make_sales_csv  # noqa: E402

_SAFE_TABLE = re.compile(r"^[A-Za-z0-9_]+$")
SHAP_TEST_PRODUCT_PREFIX = "pytest-"


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


def _qdrant_reachable() -> bool:
    try:
        with socket.create_connection((settings.QDRANT_HOST, settings.QDRANT_PORT), timeout=0.5):
            return True
    except OSError:
        return False


@pytest.fixture(scope="session", autouse=True)
def vector_store_fallback():
    """Use a real Qdrant server when one is running, otherwise an in-memory store.

    The query, explain and document routes all construct the vector store while
    resolving dependencies, so without a server every one of them fails before
    request validation even runs. These are API-contract tests, not Qdrant tests.
    """
    if _qdrant_reachable():
        yield
        return
    store = InMemoryVectorStore()
    app.dependency_overrides[get_vector_store] = lambda: store
    yield
    app.dependency_overrides.pop(get_vector_store, None)


def _drop_test_artifacts(table_names: list[str], dataset_ids: list[str]) -> None:
    import psycopg2

    dsn = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            for table in table_names:
                if _SAFE_TABLE.match(table):
                    cur.execute(f'DROP TABLE IF EXISTS "{table}"')
            if dataset_ids:
                cur.execute("DELETE FROM dataset_metadata WHERE id::text = ANY(%s)", (dataset_ids,))
            cur.execute("DELETE FROM shap_cache WHERE product_id LIKE %s", (f"{SHAP_TEST_PRODUCT_PREFIX}%",))
    finally:
        conn.close()


@pytest.fixture(scope="session")
def dataset_factory():
    """Ingest a synthetic daily-sales CSV and return its ids.

    Every dataset created is dropped (table + metadata row) at session end so test
    runs stop accumulating ``dataset_*`` tables in the database.
    """
    client = TestClient(app)
    created: list[dict] = []

    def make(days: int | None = None, filename: str = "pytest_sales.csv") -> dict:
        kwargs = {"days": days} if days else {}
        csv_text, last_date = make_sales_csv(**kwargs)
        res = client.post("/api/v1/ingest/csv", files={"file": (filename, csv_text.encode("utf-8"), "text/csv")})
        assert res.status_code in (200, 201), f"Ingestion failed: {res.text}"
        body = res.json()
        info = {
            "dataset_id": body["dataset_id"],
            "table_name": body["table_name"],
            "row_count": body["row_count"],
            "last_date": last_date,
        }
        created.append(info)
        return info

    yield make

    _drop_test_artifacts([d["table_name"] for d in created], [d["dataset_id"] for d in created])


@pytest.fixture(scope="session")
def sales_dataset(dataset_factory) -> dict:
    """One shared, ingested dataset with enough history to train on."""
    return dataset_factory()
