"""End-to-End User Flow & API Contract Verification Suite.
Task: [QA-CHAOS-02] End-to-End User Flow & API Contract Verification Suite.

Validates the complete user journey:
CSV Ingest -> Schema Profiling -> Observatory Dashboard -> Prophet Model Fit -> Multi-Lever Simulation -> AI NL2SQL Query.
"""

import io
import math
from fastapi.testclient import TestClient

from src.main import app
from tests.helpers import DEFAULT_DAYS

client = TestClient(app)


def test_complete_e2e_user_journey(dataset_factory):
    """Execute complete end-to-end user journey across all backend micro-services."""

    # STEP 1: Ingest CSV Data (via the shared factory, which cleans up after the run)
    ingest = dataset_factory(filename="e2e_retail_sales.csv")
    dataset_id = ingest["dataset_id"]
    assert ingest["table_name"] is not None
    assert ingest["row_count"] == DEFAULT_DAYS

    # STEP 2: Observatory Dashboard Summary Metrics
    summary_res = client.get(f"/api/v1/data/summary?dataset_id={dataset_id}")
    assert summary_res.status_code == 200, f"Dashboard summary failed: {summary_res.text}"
    summary_data = summary_res.json()["data"]
    assert summary_data is not None

    # STEP 3: Prophet Forecasting Model Fit
    train_res = client.post(
        "/api/v1/forecast/train",
        json={"granularity": "daily", "dataset_id": dataset_id}
    )
    assert train_res.status_code in [200, 201, 202], f"Model training failed: {train_res.text}"
    train_data = train_res.json()["data"]
    assert "training_id" in train_data or "status" in train_data or "model_id" in train_data

    # STEP 4: Forecast Prediction Contract
    predict_res = client.get(f"/api/v1/forecast/predict?horizon_days=14&dataset_id={dataset_id}")
    assert predict_res.status_code == 200, f"Forecast predict failed: {predict_res.text}"
    predict_data = predict_res.json()["data"]
    forecast_points = predict_data.get("forecast", predict_data.get("points", []))
    assert len(forecast_points) > 0

    # STEP 5: Multi-Lever Simulation & SHAP Forces
    sim_res = client.post(
        "/api/v1/forecast/simulate",
        json={
            "mutations": {"marketing_spend": "+250", "unit_price": "-5"},
            "horizon_days": 14,
            "dataset_id": dataset_id,
        }
    )
    assert sim_res.status_code == 200, f"Simulation failed: {sim_res.text}"
    sim_data = sim_res.json()["data"]
    assert "points" in sim_data
    assert len(sim_data["points"]) > 0

    # Verify no NaN or infinite values in simulated points
    for point in sim_data["points"]:
        for key in ("baseline_predicted", "mutated_predicted"):
            val = point[key]
            assert not math.isnan(val), f"NaN detected in simulation point {key}: {point}"
            assert not math.isinf(val), f"Infinite value detected in simulation point {key}: {point}"

    # Verify SHAP forces structure
    assert "shap_positive_forces" in sim_data or "forces" in sim_data or "shap_drivers" in sim_data

    # STEP 6: AI NL2SQL Query Execution
    query_res = client.post(
        "/api/v1/query",
        json={"question": "What is the total revenue and units sold?", "dataset_id": dataset_id}
    )
    # Query must respond cleanly without unhandled 500 error
    assert query_res.status_code in [200, 400, 502], f"Unexpected 500 on NL2SQL query: {query_res.text}"
    if query_res.status_code == 200:
        query_data = query_res.json()["data"]
        assert "answer" in query_data or "generated_sql" in query_data


def test_api_contract_defensive_error_handling():
    """Verify backend defensive contracts and error boundaries return RFC-compliant 4xx status codes."""
    
    # Case 1: Empty / invalid file upload
    empty_res = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("", io.BytesIO(b""), "text/csv")}
    )
    assert empty_res.status_code in [400, 422], "Expected 400/422 for empty file"

    # Case 2: Negative horizon days in predict
    neg_predict_res = client.get("/api/v1/forecast/predict?horizon_days=-10")
    assert neg_predict_res.status_code in [400, 422], "Expected 400/422 for negative forecast horizon"

    # Case 3: Missing question in NL2SQL query
    empty_query_res = client.post("/api/v1/query", json={})
    assert empty_query_res.status_code == 422, "Expected 422 Validation Error for missing question"

    # Case 4: Non-existent document search
    search_empty = client.post("/api/v1/documents/search", json={"query": "nonexistent term", "top_k": 3})
    assert search_empty.status_code == 200, "Empty document search should return empty results, not crash"
    assert search_empty.json()["status"] == "success"
