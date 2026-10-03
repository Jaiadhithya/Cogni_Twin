"""/metrics exposure, API-key gating and metric feeds."""

import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.infrastructure.metrics import LLM_CALLS, track_llm
from src.main import app


def test_metrics_exposes_request_counters():
    client = TestClient(app)
    client.get("/api/v1/health")
    text = client.get("/metrics").text
    assert "http_requests_total" in text and "http_request_duration_seconds" in text
    assert 'route="/health"' in text


def test_metrics_requires_key_unless_public(monkeypatch):
    monkeypatch.setattr(settings, "API_KEY", "secret")
    client = TestClient(app)
    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"X-API-Key": "secret"}).status_code == 200
    monkeypatch.setattr(settings, "METRICS_PUBLIC", True)
    assert client.get("/metrics").status_code == 200


@pytest.mark.asyncio
async def test_llm_tracking_counts_ok_and_error():
    @track_llm("unit_test_op")
    async def call(fail):
        if fail:
            raise RuntimeError("x")
        return 1

    ok_before = LLM_CALLS.labels("unit_test_op", "ok")._value.get()
    err_before = LLM_CALLS.labels("unit_test_op", "error")._value.get()
    await call(False)
    with pytest.raises(RuntimeError):
        await call(True)
    assert LLM_CALLS.labels("unit_test_op", "ok")._value.get() == ok_before + 1
    assert LLM_CALLS.labels("unit_test_op", "error")._value.get() == err_before + 1
