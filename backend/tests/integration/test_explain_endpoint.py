"""End to end: the explanation is for the selected dataset and matches its forecast chart."""

from datetime import timedelta

import psycopg2
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app

client = TestClient(app)


def test_explain_endpoint_matches_the_datasets_forecast_and_caches(dataset_factory):
    info = dataset_factory(days=400, filename="pytest_explain.csv")
    ds, last = info["dataset_id"], info["last_date"]
    train = client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds})
    assert train.status_code == 200, train.text
    model_id = train.json()["data"]["training_id"]

    # Another dataset trained afterwards must not change what this dataset's explanation shows.
    other = dataset_factory(days=90, filename="pytest_explain_other.csv")
    assert client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": other["dataset_id"]}).status_code == 200

    forecast_date = (last + timedelta(days=3)).isoformat()
    predicted = {
        p["date"]: p["predicted"]
        for p in client.get(f"/api/v1/forecast/predict?horizon_days=7&dataset_id={ds}").json()["data"]["forecast"]
    }
    try:
        first = client.get(f"/api/v1/forecast/explain/aggregate?forecast_date={forecast_date}&dataset_id={ds}")
        assert first.status_code == 200, first.text
        data = first.json()["data"]
        assert data["method"] == "prophet_component_decomposition"
        assert abs(data["predicted_value"] - predicted[forecast_date]) < 0.05
        assert data["top_positive_drivers"] or data["top_negative_drivers"]
        assert "shap" not in data["explanation_text"].lower()

        second = client.get(f"/api/v1/forecast/explain/aggregate?forecast_date={forecast_date}&dataset_id={ds}").json()["data"]
        assert second["predicted_value"] == data["predicted_value"]
        assert second["base_value"] == data["base_value"]

        conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT method, computed_at FROM shap_cache WHERE model_id = %s", (model_id,))
                rows = cur.fetchall()
        finally:
            conn.close()
        assert len(rows) == 1 and rows[0][0] == "prophet_component_decomposition" and rows[0][1] is not None
    finally:
        conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
        try:
            with conn, conn.cursor() as cur:
                cur.execute("DELETE FROM shap_cache WHERE model_id = %s", (model_id,))
        finally:
            conn.close()
