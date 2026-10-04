"""GET /data/uploads lists the datasets ingested through /ingest/csv."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def _listed_ids(page_size: int = 100) -> dict[str, dict]:
    res = client.get(f"/api/v1/data/uploads?page=1&page_size={page_size}")
    assert res.status_code == 200, res.text
    return {r["id"]: r for r in res.json()["data"]["records"]}


def test_ingested_dataset_is_listed_then_gone_after_delete(dataset_factory):
    ds = dataset_factory(days=40, filename="pytest_listing.csv")

    listed = _listed_ids()
    assert ds["dataset_id"] in listed
    record = listed[ds["dataset_id"]]
    assert record["filename"] == "pytest_listing.csv"
    assert record["row_count"] == ds["row_count"]
    assert record["entity_type"] == "dynamic"
    assert record["status"] == "completed"
    assert record["created_at"]

    assert client.delete(f"/api/v1/data/uploads/{ds['dataset_id']}").status_code == 200
    assert ds["dataset_id"] not in _listed_ids()


def test_listing_is_newest_first_and_paginated(dataset_factory):
    older = dataset_factory(days=40, filename="pytest_older.csv")
    newer = dataset_factory(days=40, filename="pytest_newer.csv")

    res = client.get("/api/v1/data/uploads?page=1&page_size=100")
    ids = [r["id"] for r in res.json()["data"]["records"]]
    assert ids.index(newer["dataset_id"]) < ids.index(older["dataset_id"])

    first = client.get("/api/v1/data/uploads?page=1&page_size=1").json()
    assert len(first["data"]["records"]) == 1
    assert first["meta"]["pagination"]["total_count"] >= 2
    assert first["data"]["records"][0]["id"] == newer["dataset_id"]
