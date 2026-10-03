"""Anomaly root-cause notes only cite drivers and documents that were actually returned."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.prescriptive_service import PrescriptiveService
from src.services.rag_service import RAGService
from tests.helpers import InMemoryVectorStore


def _forecast(anomalous: bool = True):
    history = [{"date": f"2026-09-{d:02d}", "actual": 100.0} for d in range(1, 31)]
    level = [70.0, 72.0, 60.0, 71.0, 73.0, 74.0, 75.0] if anomalous else [101.0] * 7
    points = [
        {"date": f"2026-10-{d + 1:02d}", "predicted": v, "lower_bound": v - 5, "upper_bound": v + 5}
        for d, v in enumerate(level)
    ]
    return {"history": history, "forecast": points}


ATTRIBUTION = {
    "method": "prophet_component_decomposition",
    "top_negative_drivers": [{"feature": "supplier_lead_time_days", "contribution": -8.2, "description": "Supply chain efficiency"}],
    "top_positive_drivers": [{"feature": "weekly", "contribution": 3.1, "description": "Day-of-week effect"}],
    "explanation_text": "text",
}


def _vector_store() -> InMemoryVectorStore:
    store = InMemoryVectorStore()
    store.upsert_vectors("doc-1", [{"chunk_id": "c1", "text": "Supplier lead time delays and shipment issues expected", "metadata": {"filename": "supplier_report.pdf"}}])
    store.upsert_vectors("doc-2", [{"chunk_id": "c2", "text": "Office holiday party catering menu", "metadata": {"filename": "party.pdf"}}])
    return store


def _service(llm_reply, forecast=None, attribution=ATTRIBUTION):
    forecast_service = MagicMock()
    forecast_service.get_forecast = AsyncMock(return_value=forecast or _forecast())
    shap_service = MagicMock()
    if isinstance(attribution, Exception):
        shap_service.get_explanation = AsyncMock(side_effect=attribution)
    else:
        shap_service.get_explanation = AsyncMock(return_value=attribution)

    async def generate_text(prompt: str, **_):
        if "Explain in 2 sentences" in prompt:
            if isinstance(llm_reply, Exception):
                raise llm_reply
            return llm_reply if isinstance(llm_reply, str) else json.dumps(llm_reply)
        raise RuntimeError("other LLM calls are not under test")

    llm = MagicMock()
    llm.generate_text = generate_text
    rag = RAGService(uow=MagicMock(), document_parser=MagicMock(), vector_store=_vector_store())
    service = PrescriptiveService(forecast_service, shap_service, llm, forecaster=MagicMock(_last_regressor_values={}), rag_service=rag)
    return service, shap_service


@pytest.mark.asyncio
async def test_llm_summary_is_used_when_it_cites_only_returned_items():
    reply = {
        "summary": "Longer supplier lead times are the main drag; the supplier report flags delays.",
        "cited_drivers": ["supplier_lead_time_days"],
        "cited_documents": ["supplier_report.pdf"],
    }
    service, shap = _service(reply)
    result = await service.get_explain_prescribe(7, dataset_id="ds-1")

    rc = result["anomaly_detected"] and result["anomaly_root_cause"]
    assert rc["summary_source"] == "llm" and "lead times" in rc["summary"]
    assert rc["method"] == "prophet_component_decomposition"
    # attribution was requested for the anomaly window's lowest day (2026-10-03 at 60.0)
    assert rc["attribution_date"] == "2026-10-03"
    assert any(c.args[1] == "2026-10-03" for c in shap.get_explanation.await_args_list)
    assert [d["feature"] for d in rc["drivers"]] == ["supplier_lead_time_days", "weekly"]
    assert rc["drivers"][0]["direction"] == "negative"
    assert [d["document_title"] for d in rc["documents"]] == ["supplier_report.pdf"]  # unrelated doc is not returned


@pytest.mark.asyncio
async def test_hallucinated_citations_are_rejected_for_a_deterministic_listing():
    reply = {"summary": "A strike at the Mumbai port caused this.", "cited_drivers": ["port_strike"], "cited_documents": ["news.pdf"]}
    service, _ = _service(reply)
    rc = (await service.get_explain_prescribe(7))["anomaly_root_cause"]

    assert rc["summary_source"] == "deterministic"
    assert "Mumbai" not in rc["summary"] and "port_strike" not in rc["summary"]
    assert "supplier_lead_time_days" in rc["summary"] and "supplier_report.pdf" in rc["summary"]


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", [RuntimeError("llm down"), "not json at all", {"summary": ""}, {"cited_drivers": []}])
async def test_llm_failure_or_malformed_output_falls_back_to_listing(reply):
    service, _ = _service(reply)
    rc = (await service.get_explain_prescribe(7))["anomaly_root_cause"]
    assert rc["summary_source"] == "deterministic"
    assert rc["summary"].startswith("Likely drivers: supplier_lead_time_days (-8.2%), weekly (+3.1%).")
    assert "Related documents: supplier_report.pdf." in rc["summary"]


@pytest.mark.asyncio
async def test_attribution_failure_still_lists_documents_and_says_nothing_else():
    service, _ = _service(RuntimeError("down"), attribution=RuntimeError("model not trained"))
    rc = (await service.get_explain_prescribe(7))["anomaly_root_cause"]
    assert rc["drivers"] == [] and rc["method"] is None
    assert rc["summary"] == "Related documents: supplier_report.pdf."


@pytest.mark.asyncio
async def test_no_anomaly_means_no_root_cause():
    service, shap = _service({"summary": "x", "cited_drivers": [], "cited_documents": []}, forecast=_forecast(anomalous=False))
    result = await service.get_explain_prescribe(7)
    assert result["anomaly_detected"] is False and result["anomaly_root_cause"] is None
