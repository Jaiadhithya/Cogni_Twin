"""Unit tests for read-only SQL enforcement in PostgresRepository."""

import pytest
from sqlalchemy import text

from src.infrastructure.database.repository import PostgresRepository


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self):
        self.executed = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def execute(self, statement, params=None):
        self.executed.append((statement, params or {}))
        return _FakeResult([{"x": 1}])


def _make_repo():
    write_session = _FakeSession()
    ro_session = _FakeSession()
    repo = PostgresRepository(write_session, readonly_session_factory=lambda: ro_session)
    return repo, write_session, ro_session


@pytest.mark.asyncio
async def test_raw_string_routed_to_readonly_engine():
    repo, write_session, ro_session = _make_repo()
    await repo.execute_readonly_sql("SELECT * FROM sales")
    assert len(ro_session.executed) == 1
    assert write_session.executed == []


@pytest.mark.asyncio
async def test_raw_string_wrapped_with_limit_cap():
    repo, _, ro_session = _make_repo()
    await repo.execute_readonly_sql("SELECT * FROM sales")
    statement, params = ro_session.executed[0]
    assert "LIMIT :max" in str(statement)
    assert params == {"max": 1000}


@pytest.mark.asyncio
async def test_custom_limit_honored():
    repo, _, ro_session = _make_repo()
    await repo.execute_readonly_sql("SELECT * FROM sales", limit=25)
    _, params = ro_session.executed[0]
    assert params == {"max": 25}


@pytest.mark.asyncio
async def test_trailing_semicolon_stripped():
    repo, _, ro_session = _make_repo()
    await repo.execute_readonly_sql("SELECT * FROM sales;;")
    statement, _ = ro_session.executed[0]
    assert ";" not in str(statement)


@pytest.mark.asyncio
async def test_text_clause_not_wrapped_and_params_passed_through():
    repo, _, ro_session = _make_repo()
    statement_in = text("SELECT * FROM shap_cache WHERE product_id = :pid")
    await repo.execute_readonly_sql(statement_in, {"pid": "abc"})
    statement, params = ro_session.executed[0]
    assert statement is statement_in
    assert params == {"pid": "abc"}
