"""End to end: a 365+ day dataset is explained with TreeSHAP, cached with its method and computed_at."""

from datetime import timedelta

import psycopg2
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app

client = TestClient(app)


def test_explain_endpoint_uses_tree_shap_and_caches_with_method(dataset_factory):
    info = dataset_factory(days=400, filename="pytest_treeshap.csv")
    ds, last = info["dataset_id"], info["last_date"]
    train = client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds})
    assert train.status_code == 200, train.text
    model_id = train.json()["data"]["training_id"]
    assert client.get(f"/api/v1/forecast/status?dataset_id={ds}").json()["data"]["model_tier"] == "prophet_lgbm"

    forecast_date = (last + timedelta(days=3)).isoformat()
    try:
        first = client.get(f"/api/v1/forecast/explain/aggregate?forecast_date={forecast_date}")
        assert first.status_code == 200, first.text
        data = first.json()["data"]
        assert data["method"] == "tree_shap" and "TreeSHAP" in data["method_note"]
        assert data["top_positive_drivers"] or data["top_negative_drivers"]
        assert "shap" not in data["explanation_text"].lower()

        second = client.get(f"/api/v1/forecast/explain/aggregate?forecast_date={forecast_date}").json()["data"]
        assert second["method"] == "tree_shap"
        assert second["predicted_value"] == data["predicted_value"] != 0.0
        assert second["base_value"] == data["base_value"]

        conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT method, computed_at, predicted_value FROM shap_cache WHERE model_id = %s", (model_id,))
                rows = cur.fetchall()
        finally:
            conn.close()
        assert len(rows) == 1 and rows[0][0] == "tree_shap" and rows[0][1] is not None
    finally:
        conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
        try:
            with conn, conn.cursor() as cur:
                cur.execute("DELETE FROM shap_cache WHERE model_id = %s", (model_id,))
        finally:
            conn.close()
