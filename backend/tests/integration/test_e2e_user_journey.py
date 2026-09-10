"""End-to-End User Flow & API Contract Verification Suite.
Task: [QA-CHAOS-02] End-to-End User Flow & API Contract Verification Suite.

Validates the complete user journey:
CSV Ingest -> Schema Profiling -> Observatory Dashboard -> Prophet Model Fit -> Multi-Lever Simulation -> AI NL2SQL Query.
"""

import io
import os
import math
import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_complete_e2e_user_journey():
    """Execute complete end-to-end user journey across all backend micro-services."""
    
    # STEP 1: Ingest CSV Data
    csv_content = """date,product_id,product_category,units_sold,unit_price,marketing_spend,net_revenue
2024-01-01,PROD-01,Hardware,20,100.0,500.0,2000.0
2024-01-02,PROD-01,Hardware,25,100.0,550.0,2500.0
2024-01-03,PROD-01,Hardware,18,100.0,480.0,1800.0
2024-01-04,PROD-01,Hardware,30,95.0,600.0,2850.0
2024-01-05,PROD-01,Hardware,22,100.0,520.0,2200.0
2024-01-06,PROD-01,Hardware,28,95.0,580.0,2660.0
2024-01-07,PROD-01,Hardware,35,90.0,650.0,3150.0
2024-01-08,PROD-01,Hardware,24,100.0,510.0,2400.0
2024-01-09,PROD-01,Hardware,29,95.0,590.0,2755.0
2024-01-10,PROD-01,Hardware,32,90.0,620.0,2880.0
2024-01-11,PROD-01,Hardware,27,95.0,540.0,2565.0
2024-01-12,PROD-01,Hardware,33,90.0,610.0,2970.0
"""
    file_obj = io.BytesIO(csv_content.encode("utf-8"))
    file_obj.name = "e2e_retail_sales.csv"

    ingest_res = client.post(
        "/api/v1/ingest/csv",
        files={"file": ("e2e_retail_sales.csv", file_obj, "text/csv")}
    )
    assert ingest_res.status_code in [200, 201], f"Ingestion step failed: {ingest_res.text}"
    ingest_data = ingest_res.json()
    dataset_id = ingest_data.get("dataset_id")
    table_name = ingest_data.get("table_name")
    assert dataset_id is not None
    assert table_name is not None
    assert ingest_data["row_count"] == 12

    # STEP 2: Observatory Dashboard Summary Metrics
    summary_res = client.get(f"/api/v1/data/summary?dataset_id={dataset_id}")
    assert summary_res.status_code == 200, f"Dashboard summary failed: {summary_res.text}"
    summary_data = summary_res.json()["data"]
    assert summary_data is not None

    # STEP 3: Prophet Forecasting Model Fit
    train_res = client.post(
        "/api/v1/forecast/train",
        json={"granularity": "daily"}
    )
    assert train_res.status_code in [200, 201, 202], f"Model training failed: {train_res.text}"
    train_data = train_res.json()["data"]
    assert "training_id" in train_data or "status" in train_data or "model_id" in train_data

    # STEP 4: Forecast Prediction Contract
    predict_res = client.get("/api/v1/forecast/predict?horizon_days=14")
    assert predict_res.status_code == 200, f"Forecast predict failed: {predict_res.text}"
    predict_data = predict_res.json()["data"]
    forecast_points = predict_data.get("forecast", predict_data.get("points", []))
    assert len(forecast_points) > 0

    # STEP 5: Multi-Lever Simulation & SHAP Forces
    sim_res = client.post(
        "/api/v1/forecast/simulate",
        json={
            "mutations": {"marketing_spend": "+250", "unit_price": "-5"},
            "horizon_days": 14
        }
    )
    assert sim_res.status_code == 200, f"Simulation failed: {sim_res.text}"
    sim_data = sim_res.json()["data"]
    assert "points" in sim_data
    assert len(sim_data["points"]) > 0

    # Verify no NaN or infinite values in simulated points
    for point in sim_data["points"]:
        val = point.get("simulated_value", point.get("yhat", 0.0))
        assert not math.isnan(val), f"NaN detected in simulation points: {point}"
        assert not math.isinf(val), f"Infinite value detected in simulation points: {point}"

    # Verify SHAP forces structure
    assert "shap_positive_forces" in sim_data or "forces" in sim_data or "shap_drivers" in sim_data

    # STEP 6: AI NL2SQL Query Execution
    query_res = client.post(
        "/api/v1/query",
        json={"question": "What is the total revenue and units sold?"}
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
