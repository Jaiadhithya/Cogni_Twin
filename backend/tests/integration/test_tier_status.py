"""/forecast/status and /forecast/backtest expose the model tier."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_status_and_backtest_report_tier(dataset_factory):
    ds = dataset_factory(days=45, filename="pytest_tier_linear.csv")["dataset_id"]
    assert client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds}).status_code == 200

    status = client.get(f"/api/v1/forecast/status?dataset_id={ds}").json()["data"]
    assert status["model_available"] is True and status["model_tier"] == "linear"

    backtest = client.get(f"/api/v1/forecast/backtest?dataset_id={ds}&test_days=10")
    assert backtest.status_code == 200, backtest.text
    assert backtest.json()["data"]["model_tier"] == "linear"
    assert "abs_errors" not in backtest.json()["data"]

    untrained = client.get("/api/v1/forecast/status?dataset_id=00000000-0000-0000-0000-00000000dead").json()["data"]
    assert untrained["model_available"] is False and untrained["model_tier"] is None
