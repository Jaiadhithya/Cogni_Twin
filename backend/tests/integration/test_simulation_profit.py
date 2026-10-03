"""Simulation responses carry gross profit and pricing, or an honest 'unavailable'."""

import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def _train(ds):
    res = client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds})
    assert res.status_code == 200, res.text


def _simulate(ds, mutations, **extra):
    res = client.post(
        "/api/v1/forecast/simulate",
        json={"dataset_id": ds, "horizon_days": 14, "mutations": mutations, **extra},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]


@pytest.fixture(scope="module")
def no_cost_ds(dataset_factory):
    ds = dataset_factory(days=60, filename="pytest_profit_nocost.csv")["dataset_id"]
    _train(ds)
    return ds


@pytest.fixture(scope="module")
def cost_ds(dataset_factory):
    ds = dataset_factory(days=60, filename="pytest_profit_cost.csv", with_cost=True)["dataset_id"]
    _train(ds)
    return ds


def test_no_cost_data_gives_null_profit_with_reason(no_cost_ds):
    data = _simulate(no_cost_ds, {"unit_price": "+10%"})
    assert data["profit"]["available"] is False
    assert data["profit"]["profit"] is None and "cost" in data["profit"]["reason"]
    assert data["pricing"]["optimal_price"]["price"] is None
    assert data["pricing"]["optimal_price"]["reason"]


def test_request_unit_cost_enables_profit(no_cost_ds):
    data = _simulate(no_cost_ds, {"unit_price": "+10%"}, unit_cost=4.0)
    profit = data["profit"]
    assert profit["available"] is True and profit["cost_source"] == "request_unit_cost"
    assert profit["unit_cost"] == 4.0 and profit["price_column"] == "unit_price"
    assert {"baseline_gross_profit", "simulated_gross_profit", "delta", "margin_guardrail"} <= set(profit)
    assert profit["margin_guardrail"]["triggered"] in (True, False)
    # elasticity fit statistics are always reported with their sample size
    assert data["pricing"]["elasticity"]["n"] >= 20


def test_dataset_cost_column_is_used(cost_ds):
    data = _simulate(cost_ds, {"marketing_spend": "+20%"})
    profit = data["profit"]
    assert profit["available"] is True and profit["cost_source"] == "dataset_column:unit_cost"
    assert profit["unit_cost"] == pytest.approx(4.0)
    # more marketing spend with a tiny volume response costs profit
    assert profit["delta"] == pytest.approx(profit["simulated_gross_profit"] - profit["baseline_gross_profit"], abs=0.02)


def test_negative_unit_cost_rejected(no_cost_ds):
    res = client.post(
        "/api/v1/forecast/simulate",
        json={"dataset_id": no_cost_ds, "horizon_days": 14, "mutations": {"unit_price": "+1%"}, "unit_cost": -1},
    )
    assert res.status_code == 422
