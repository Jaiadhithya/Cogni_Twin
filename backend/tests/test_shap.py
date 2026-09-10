import pytest
import io
import json
from fastapi.testclient import TestClient
from src.main import app
from src.config import settings

client = TestClient(app)

def test_shap_regressors_dynamic_forces():
    # The dataset is already seeded and trained per the workflow assumptions.
    
    # 1. Get explain-prescribe data
    shap_response = client.get("/api/v1/forecast/explain-prescribe?horizon_days=7")
    assert shap_response.status_code == 200, f"SHAP failed: {shap_response.text}"
    
    data = shap_response.json()["data"]
    
    # Verify positive/negative force data and dynamically generated regressors
    assert "shap_drivers" in data, "Drivers missing from response"
    assert "positive" in data["shap_drivers"], "Positive forces missing"
    assert "negative" in data["shap_drivers"], "Negative forces missing"
    
    assert len(data["shap_drivers"]["positive"]) > 0 or len(data["shap_drivers"]["negative"]) > 0, "No forces returned"
