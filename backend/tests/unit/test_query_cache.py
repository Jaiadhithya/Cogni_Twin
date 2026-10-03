"""/query result cache: reuse, TTL, invalidation."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.config import settings
from src.infrastructure.database.repository import invalidate_table_schemas
from src.infrastructure.query_cache import InProcessQueryCache, query_cache
from src.services.query_service import QueryService


def test_key_normalises_question_and_scopes_dataset():
    c = InProcessQueryCache()
    c.put("d1", "  Total  Sales? ", {"a": 1}, ttl=60)
    assert c.get("d1", "total sales?") == {"a": 1}
    assert c.get("d2", "total sales?") is None


def test_ttl_expiry_and_zero_disables(monkeypatch):
    c = InProcessQueryCache()
    c.put("d", "q", {"a": 1}, ttl=0)
    assert c.get("d", "q") is None
    c.put("d", "q", {"a": 1}, ttl=0.0001)
    import time; time.sleep(0.01)
    assert c.get("d", "q") is None


def test_returned_results_are_copies():
    c = InProcessQueryCache()
    c.put("d", "q", {"a": [1]}, ttl=60)
    c.get("d", "q")["a"].append(2)
    assert c.get("d", "q") == {"a": [1]}


@pytest.mark.asyncio
async def test_service_caches_sql_answers_until_invalidated(monkeypatch):
    query_cache.invalidate()
    monkeypatch.setattr(settings, "QUERY_CACHE_TTL_SECONDS", 60)
    service = QueryService(uow=MagicMock(), llm_client=MagicMock())
    service._try_relationship_query = AsyncMock(return_value=None)
    service._classify_intent = AsyncMock(return_value=__import__("src.domain.value_objects.query_intent", fromlist=["QueryIntent"]).QueryIntent.SQL)
    service._execute_sql_query = AsyncMock(return_value={"source": "SQL", "confidence": "high", "answer": "x"})

    await service.execute_query("how many units sold", "d1")
    await service.execute_query("How many  units sold", "d1")
    assert service._execute_sql_query.await_count == 1

    invalidate_table_schemas()  # upload / undo
    await service.execute_query("how many units sold", "d1")
    assert service._execute_sql_query.await_count == 2


@pytest.mark.asyncio
async def test_low_confidence_and_other_sources_are_not_cached(monkeypatch):
    query_cache.invalidate()
    monkeypatch.setattr(settings, "QUERY_CACHE_TTL_SECONDS", 60)
    service = QueryService(uow=MagicMock(), llm_client=MagicMock())
    service._route_query = AsyncMock(side_effect=[
        {"source": "SQL", "confidence": "low"}, {"source": "SQL", "confidence": "low"},
        {"source": "DOCUMENT", "confidence": "high"}, {"source": "DOCUMENT", "confidence": "high"},
    ])
    for q in ("q one here", "q one here", "q two here", "q two here"):
        await service.execute_query(q, "d")
    assert service._route_query.await_count == 4
