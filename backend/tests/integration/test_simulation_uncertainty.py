"""What-if simulations return calibrated intervals for baseline and scenario."""

import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def _simulate(ds, horizon=14):
    res = client.post(
        "/api/v1/forecast/simulate",
        json={"dataset_id": ds, "horizon_days": horizon, "mutations": {"marketing_spend": "+20%"}},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]


def test_split_conformal_bands_with_enough_history(sales_dataset):
    ds = sales_dataset["dataset_id"]
    assert client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds}).status_code == 200
    data = _simulate(ds)
    unc = data["uncertainty"]

    assert unc["method"] == "split_conformal" and unc["calibration_points"] == 28
    assert unc["dates"] == [p["date"] for p in data["points"]]
    assert set(unc["levels"]) == {"80", "95"}
    for level in ("80", "95"):
        for series, key in (("baseline", "baseline_predicted"), ("scenario", "mutated_predicted")):
            band = unc["levels"][level][series]
            assert len(band["lower"]) == len(band["upper"]) == len(data["points"])
            for lo, hi, p in zip(band["lower"], band["upper"], data["points"]):
                assert lo <= p[key] <= hi
    assert unc["levels"]["95"]["half_width"] >= unc["levels"]["80"]["half_width"]


def test_prophet_fallback_when_history_is_short(dataset_factory):
    ds = dataset_factory(days=40, filename="pytest_unc_short.csv")["dataset_id"]
    assert client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds}).status_code == 200
    unc = _simulate(ds)["uncertainty"]

    assert unc["method"] == "prophet_intervals"
    assert set(unc["levels"]) == {"80"}
    assert unc["notes"] and "history" in unc["notes"][0]
    band = unc["levels"]["80"]["baseline"]
    assert len(band["lower"]) == 14 and all(lo <= hi for lo, hi in zip(band["lower"], band["upper"]))
