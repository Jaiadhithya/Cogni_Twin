import pytest
import httpx
from src.main import app

@pytest.mark.asyncio
async def test_simulate_returns_forecast_and_shap():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # Train first
        train_res = await ac.post("/api/v1/forecast/train", json={"granularity": "daily"})
        assert train_res.status_code in [200, 202, 201]

        # Simulate
        payload = {
            "mutations": {"marketing_spend": "+500"},
            "horizon_days": 30
        }
        res = await ac.post("/api/v1/forecast/simulate", json=payload)
        assert res.status_code == 200
        
        data = res.json()["data"]
        assert "points" in data
        assert "shap_positive_forces" in data
        assert "shap_negative_forces" in data
