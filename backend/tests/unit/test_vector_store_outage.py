"""A Qdrant outage only affects document features, never data questions."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.domain.exceptions import VectorStoreError
from src.infrastructure.vector import lazy_store
from src.infrastructure.vector.lazy_store import LazyVectorStore, UNAVAILABLE_MESSAGE
from src.services.query_service import QueryService


class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def test_lazy_store_does_not_connect_until_used():
    factory = MagicMock()
    LazyVectorStore(factory)
    factory.assert_not_called()


def test_lazy_store_delegates_once_connected():
    inner = MagicMock()
    inner.search_vectors.return_value = ["hit"]
    factory = MagicMock(return_value=inner)
    store = LazyVectorStore(factory)
    assert store.search_vectors("q", 3) == ["hit"]
    assert store.search_vectors("q", 3) == ["hit"]
    factory.assert_called_once()


def test_lazy_store_remembers_failure_then_retries():
    clock = _Clock()
    factory = MagicMock(side_effect=RuntimeError("connect timeout to localhost:6333"))
    store = LazyVectorStore(factory, clock=clock)

    with pytest.raises(VectorStoreError) as err:
        store.search_vectors("q")
    assert str(err.value) == UNAVAILABLE_MESSAGE
    assert "6333" not in str(err.value) and "localhost" not in str(err.value)

    with pytest.raises(VectorStoreError):
        store.search_vectors("q")  # inside the cool-down: no second connection attempt
    assert factory.call_count == 1

    clock.t = lazy_store.RETRY_AFTER_SECONDS + 1
    factory.side_effect = None
    factory.return_value = MagicMock(search_vectors=MagicMock(return_value=[]))
    assert store.search_vectors("q") == []
    assert factory.call_count == 2


@pytest.mark.asyncio
async def test_document_question_is_answered_honestly_when_search_is_down():
    rag = MagicMock()
    rag.generate_answer = AsyncMock(side_effect=VectorStoreError(UNAVAILABLE_MESSAGE))
    qs = QueryService(uow=MagicMock(), llm_client=MagicMock(), rag_service=rag)

    res = await qs._execute_document_query("What does the supplier contract say about delays?")
    assert res["source"] == "DOCUMENT"
    assert res["confidence"] == "low"
    assert "unavailable" in res["answer"]
    assert res["raw_data"] == []


@pytest.mark.asyncio
async def test_fused_question_falls_back_to_data_when_search_is_down():
    rag = MagicMock()
    rag.generate_answer = AsyncMock(side_effect=VectorStoreError(UNAVAILABLE_MESSAGE))
    qs = QueryService(uow=MagicMock(), llm_client=MagicMock(), rag_service=rag, shap_service=MagicMock())
    sql_answer = {"answer": "Revenue was ₹6.9 Cr.", "insights": ["Up 20%"], "source": "SQL", "confidence": "high"}
    qs._execute_sql_query = AsyncMock(return_value=sql_answer)

    res = await qs._execute_fused_query("Why did revenue rise?")
    assert res["answer"] == "Revenue was ₹6.9 Cr."
    assert res["insights"][0] == "Up 20%"
    assert "data only" in res["insights"][-1]


@pytest.mark.asyncio
async def test_search_outage_is_not_reported_as_no_documents():
    from src.services.rag_service import RAGService

    store = MagicMock()
    store.search_vectors.side_effect = VectorStoreError(UNAVAILABLE_MESSAGE)
    rag = RAGService(uow=MagicMock(), document_parser=MagicMock(), vector_store=store, llm_client=MagicMock())
    with pytest.raises(VectorStoreError):
        await rag.search_documents("late delivery penalties")


@pytest.mark.asyncio
async def test_executive_summary_uses_plain_language_driver_names():
    from src.services.prescriptive_service import PrescriptiveService

    llm = MagicMock()
    llm.generate_text = AsyncMock(return_value="summary")
    svc = PrescriptiveService(forecast_service=MagicMock(), shap_service=MagicMock(), llm_client=llm, forecaster=MagicMock())
    await svc._generate_executive_summary(
        forecast_points=[],
        positive_drivers=[{"feature": "resid_roll_mean_28", "description": "Recent 28-day unexplained trend", "contribution": 5, "direction": "positive"}],
        negative_drivers=[{"feature": "discount_pct", "description": "", "contribution": -3, "direction": "negative"}],
        anomaly_detected=False,
        anomaly_description=None,
        prescriptive_actions=[],
    )
    prompt = llm.generate_text.await_args.kwargs["prompt"]
    assert "resid" not in prompt
    assert "Recent 28-day unexplained trend" in prompt
    assert "discount pct" in prompt  # no description: falls back to the readable name
