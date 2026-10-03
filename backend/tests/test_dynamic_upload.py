import uuid
from datetime import timedelta

from fastapi.testclient import TestClient
from src.main import app
from tests.conftest import SHAP_TEST_PRODUCT_PREFIX

client = TestClient(app)

# Regressor columns that the generated dataset exposes to Prophet.
DYNAMIC_REGRESSORS = {"unit_price", "marketing_spend", "supplier_lead_time_days", "competitor_discount_pct"}


def test_dynamic_upload_and_shap(dataset_factory):
    # 1. Upload a CSV with dynamic columns that become exogenous regressors
    dataset = dataset_factory(filename="sales_data.csv")

    # 2. Train the forecast model so that regressors are generated and SHAP can be used
    train_response = client.post(
        "/api/v1/forecast/train?wait=true",
        json={"granularity": "daily", "dataset_id": dataset["dataset_id"]},
    )
    assert train_response.status_code == 200, f"Training failed: {train_response.text}"

    # 3. Request SHAP explanation for the day after the history ends.
    # A unique product id keeps this clear of cached explanations from earlier runs.
    forecast_date = (dataset["last_date"] + timedelta(days=1)).isoformat()
    product_id = f"{SHAP_TEST_PRODUCT_PREFIX}{uuid.uuid4().hex[:8]}"
    shap_response = client.get(f"/api/v1/forecast/explain/{product_id}?forecast_date={forecast_date}")
    assert shap_response.status_code == 200, f"SHAP explanation failed: {shap_response.text}"

    shap_data = shap_response.json()
    assert "data" in shap_data

    explanation = shap_data["data"]
    assert "base_value" in explanation
    assert "forces" in explanation

    # Verify forces contain positive and negative values or just attributes
    forces = explanation["forces"]
    assert len(forces) > 0, "No SHAP forces returned"

    has_regressor = any(force["feature_name"] in DYNAMIC_REGRESSORS for force in forces)
    assert has_regressor, "Dynamically uploaded regressor column is missing in SHAP forces"
