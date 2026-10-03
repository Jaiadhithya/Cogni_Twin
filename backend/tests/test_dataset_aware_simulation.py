import pytest
import httpx
from src.main import app

@pytest.mark.asyncio
async def test_dataset_aware_multi_lever_simulation_and_shap(sales_dataset):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # 1. Train a model bound to a specific dataset
        train_res = await ac.post(
            "/api/v1/forecast/train?wait=true",
            json={"granularity": "daily", "dataset_id": sales_dataset["dataset_id"]},
        )
        assert train_res.status_code in [200, 201, 202], train_res.text
        train_data = train_res.json()["data"]
        assert train_data["dataset_id"] == sales_dataset["dataset_id"]
        assert train_data["data_points_used"] > 0

        # 2. Multi-lever simultaneous composite shocks
        sim_payload = {
            "dataset_id": train_data["dataset_id"],
            "mutations": {
                "unit_price": "+15%",
                "marketing_spend": "+500",
                "supplier_lead_time_days": "-2"
            },
            "horizon_days": 30
        }
        sim_res = await ac.post("/api/v1/forecast/simulate", json=sim_payload)
        assert sim_res.status_code == 200
        sim_data = sim_res.json()["data"]

        # Validate basic simulation outputs
        assert "available_levers" in sim_data
        assert "total_delta" in sim_data
        assert "total_delta_pct" in sim_data
        assert "baseline_total" in sim_data
        assert "mutated_total" in sim_data
        assert "points" in sim_data
        assert len(sim_data["points"]) == 30

        # Validate SHAP driver forces
        assert "shap_forces" in sim_data
        assert "shap_positive_forces" in sim_data
        assert "shap_negative_forces" in sim_data
        
        forces = sim_data["shap_forces"]
        assert len(forces) > 0, "Expected at least one decomposed SHAP force driver"
        for force in forces:
            assert "feature" in force
            assert "delta_force" in force
            assert "contribution_pct" in force
            assert "direction" in force
            assert "economic_narrative" in force
            assert force["direction"].lower() in ["positive", "negative"]

        # 3. Verify Dataset Isolation: Untrained dataset_id must fail / reject simulation
        bad_dataset_payload = {
            "dataset_id": "isolated_non_existent_dataset_xyz",
            "mutations": {"unit_price": "+10%"},
            "horizon_days": 14
        }
        bad_sim_res = await ac.post("/api/v1/forecast/simulate", json=bad_dataset_payload)
        assert bad_sim_res.status_code in [400, 404, 500]

        # 4. Verify NL2SQL / Simulation query routing with dataset_id
        query_payload = {
            "question": "What if we increase price by 10% and boost marketing budget by 20%?",
            "dataset_id": train_data["dataset_id"]
        }
        query_res = await ac.post("/api/v1/query", json=query_payload)
        assert query_res.status_code == 200
        q_data = query_res.json()["data"]
        assert "answer" in q_data
        assert "insights" in q_data
        assert "charts" in q_data
