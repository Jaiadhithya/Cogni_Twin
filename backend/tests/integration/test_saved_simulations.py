"""Saved what-if scenarios: save, list (scoped, paginated) and compare."""

import uuid

import psycopg2
import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def two_trained_datasets(dataset_factory):
    ids = []
    for name in ("pytest_sim_a.csv", "pytest_sim_b.csv"):
        ds = dataset_factory(days=40, filename=name)["dataset_id"]
        res = client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": ds})
        assert res.status_code == 200, res.text
        ids.append(ds)
    yield ids
    conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        with conn, conn.cursor() as cur:
            cur.execute("DELETE FROM simulation_runs WHERE dataset_id = ANY(%s)", (ids,))
    finally:
        conn.close()


def _simulate(ds, mutations, **extra):
    res = client.post(
        "/api/v1/forecast/simulate",
        json={"dataset_id": ds, "horizon_days": 14, "mutations": mutations, **extra},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]


def test_simulate_without_save_does_not_persist(two_trained_datasets):
    ds_a, _ = two_trained_datasets
    assert _simulate(ds_a, {"marketing_spend": "+10%"})["run_id"] is None
    assert client.get(f"/api/v1/forecast/simulations?dataset_id={ds_a}").json()["meta"]["pagination"]["total_count"] == 0


def test_save_list_scope_pagination_and_compare(two_trained_datasets):
    ds_a, ds_b = two_trained_datasets
    run1 = _simulate(ds_a, {"marketing_spend": "+20%"}, save=True, name="more marketing")["run_id"]
    run2 = _simulate(ds_a, {"marketing_spend": "-20%"}, save=True)["run_id"]
    run3 = _simulate(ds_b, {"marketing_spend": "+20%"}, save=True, name="other dataset")["run_id"]
    assert run1 and run2 and run3

    listed_a = client.get(f"/api/v1/forecast/simulations?dataset_id={ds_a}").json()
    assert {r["id"] for r in listed_a["data"]["records"]} == {run1, run2}
    assert listed_a["data"]["records"][0]["id"] == run2  # newest first
    named = next(r for r in listed_a["data"]["records"] if r["id"] == run1)
    assert named["name"] == "more marketing" and named["horizon_days"] == 14
    assert named["mutations"] == {"marketing_spend": "+20%"}
    assert set(named["delta_metrics"]) == {"total_delta", "total_delta_pct"}

    listed_b = client.get(f"/api/v1/forecast/simulations?dataset_id={ds_b}").json()
    assert [r["id"] for r in listed_b["data"]["records"]] == [run3]

    page = client.get(f"/api/v1/forecast/simulations?dataset_id={ds_a}&page=2&page_size=1").json()
    assert page["meta"]["pagination"] == {"page": 2, "page_size": 1, "total_count": 2, "total_pages": 2}
    assert len(page["data"]["records"]) == 1

    cmp = client.get(f"/api/v1/forecast/simulations/compare?ids={run1},{run2}")
    assert cmp.status_code == 200, cmp.text
    data = cmp.json()["data"]
    assert data["run_ids"] == [run1, run2]
    metrics = {m["metric"]: m["values"] for m in data["metrics"]}
    assert set(metrics) == {
        "baseline_total", "baseline_daily_average", "simulated_total",
        "simulated_daily_average", "total_delta", "total_delta_pct",
    }
    assert all(len(v) == 2 for v in metrics.values())
    # +20% vs -20% marketing must not produce the same projected total
    assert metrics["simulated_total"][0] != metrics["simulated_total"][1]
    assert metrics["baseline_total"][0] == pytest.approx(metrics["baseline_total"][1])

    # order of ids is the order of the columns
    flipped = client.get(f"/api/v1/forecast/simulations/compare?ids={run2},{run1}").json()["data"]
    assert flipped["run_ids"] == [run2, run1]


def test_compare_validation(two_trained_datasets):
    ds_a, ds_b = two_trained_datasets
    a = _simulate(ds_a, {"marketing_spend": "+5%"}, save=True)["run_id"]
    b = _simulate(ds_b, {"marketing_spend": "+5%"}, save=True)["run_id"]

    assert client.get(f"/api/v1/forecast/simulations/compare?ids={a},{b}").status_code == 400  # mixed datasets
    assert client.get(f"/api/v1/forecast/simulations/compare?ids={a}").status_code == 400  # need two
    assert client.get(f"/api/v1/forecast/simulations/compare?ids={a},not-a-uuid").status_code == 400
    missing = client.get(f"/api/v1/forecast/simulations/compare?ids={a},{uuid.uuid4()}")
    assert missing.status_code == 404
