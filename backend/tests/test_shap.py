import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_shap_regressors_dynamic_forces(sales_dataset):
    dataset_id = sales_dataset["dataset_id"]

    # 1. Train a model for the dataset so explanations have something to decompose
    train_response = client.post("/api/v1/forecast/train", json={"granularity": "daily", "dataset_id": dataset_id})
    assert train_response.status_code == 200, f"Training failed: {train_response.text}"

    # 2. Get explain-prescribe data
    shap_response = client.get(f"/api/v1/forecast/explain-prescribe?horizon_days=7&dataset_id={dataset_id}")
    assert shap_response.status_code == 200, f"SHAP failed: {shap_response.text}"

    data = shap_response.json()["data"]

    # Verify positive/negative force data and dynamically generated regressors
    assert "shap_drivers" in data, "Drivers missing from response"
    assert "positive" in data["shap_drivers"], "Positive forces missing"
    assert "negative" in data["shap_drivers"], "Negative forces missing"

    assert len(data["shap_drivers"]["positive"]) > 0 or len(data["shap_drivers"]["negative"]) > 0, "No forces returned"
