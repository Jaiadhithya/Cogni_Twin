import pytest
from fastapi.testclient import TestClient
from src.main import app
import json
import io

client = TestClient(app)

def test_dynamic_upload_and_shap():
    # 1. Upload a CSV file
    # This data should have dynamic columns to generate regressors, e.g., 'marketing_spend'
    csv_data = """date,product_id,units_sold,unit_price,total_amount,marketing_spend,price
2023-01-01,P001,100,10.0,1000.0,500.0,10.0
2023-01-02,P001,150,10.0,1500.0,600.0,10.0
2023-01-03,P001,130,10.0,1300.0,550.0,10.0
2023-01-04,P001,140,10.0,1400.0,500.0,10.0
2023-01-05,P001,180,9.0,1620.0,700.0,9.0
2023-01-06,P001,120,10.5,1260.0,450.0,10.5
2023-01-07,P001,160,9.5,1520.0,650.0,9.5
2023-01-08,P001,150,10.0,1500.0,600.0,10.0
2023-01-09,P001,170,9.0,1530.0,680.0,9.0
2023-01-10,P001,190,8.5,1615.0,750.0,8.5
"""
    file_obj = io.BytesIO(csv_data.encode("utf-8"))
    file_obj.name = "sales_data.csv"
    
    response = client.post(
        "/api/v1/ingest/csv", 
        files={"file": ("sales_data.csv", file_obj, "text/csv")}
    )
    
    assert response.status_code in [200, 201], f"Upload failed: {response.text}"
    
    # 2. Train the forecast model so that regressors are generated and SHAP can be used
    train_response = client.post("/api/v1/forecast/train", json={"granularity": "daily"})
    assert train_response.status_code == 200, f"Training failed: {train_response.text}"
    
    # 3. Request SHAP explanation
    shap_response = client.get("/api/v1/forecast/explain/P001?forecast_date=2023-01-11")
    assert shap_response.status_code == 200, f"SHAP explanation failed: {shap_response.text}"
    
    shap_data = shap_response.json()
    assert "data" in shap_data
    
    explanation = shap_data["data"]
    assert "base_value" in explanation
    assert "forces" in explanation
    
    # Verify forces contain positive and negative values or just attributes
    forces = explanation["forces"]
    assert len(forces) > 0, "No SHAP forces returned"
    
    has_regressor = any(force["feature_name"] == "marketing_spend" or force["feature_name"] == "price" for force in forces)
    assert has_regressor, "Dynamically uploaded regressor column is missing in SHAP forces"
    
