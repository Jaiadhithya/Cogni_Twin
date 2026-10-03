"""Undoing an upload removes the dataset and everything derived from it."""

import os
import uuid

import psycopg2
import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.infrastructure.database import repository as repo_module
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.main import app

client = TestClient(app)


def _scalar(sql: str, params: tuple = ()):
    conn = psycopg2.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        with conn, conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _table_exists(name: str) -> bool:
    return bool(_scalar("SELECT to_regclass(%s) IS NOT NULL", (f"public.{name}",)))


def _metadata_exists(dataset_id: str) -> bool:
    return _scalar("SELECT count(*) FROM dataset_metadata WHERE id::text = %s", (dataset_id,)) == 1


def test_undo_removes_table_metadata_cache_and_models(dataset_factory, sales_dataset):
    doomed = dataset_factory(days=40, filename="pytest_undo.csv")
    doomed_id, doomed_table = doomed["dataset_id"], doomed["table_name"]

    train = client.post("/api/v1/forecast/train?wait=true", json={"granularity": "daily", "dataset_id": doomed_id})
    assert train.status_code == 200, train.text
    model_id = train.json()["data"]["training_id"]

    storage = JsonModelStorage()
    assert storage.model_ids_for_dataset(doomed_id) == [model_id]
    model_file = os.path.join(storage.models_dir, f"{model_id}.json")
    assert os.path.exists(model_file)
    repo_module._table_schema_cache[doomed_table] = "stale schema context"
    survivor_before = sales_dataset["table_name"]

    res = client.delete(f"/api/v1/data/uploads/{doomed_id}")
    assert res.status_code == 200, res.text
    assert res.json()["data"]["models_removed"] == 1

    assert not _table_exists(doomed_table)
    assert not _metadata_exists(doomed_id)
    assert not os.path.exists(model_file)
    assert storage.model_ids_for_dataset(doomed_id) == []
    assert storage.get_latest_model_info(dataset_id=doomed_id) is None
    assert doomed_table not in repo_module._table_schema_cache

    # the other dataset is untouched
    assert _table_exists(survivor_before)
    assert _metadata_exists(sales_dataset["dataset_id"])


def test_undo_unknown_dataset_is_404():
    res = client.delete(f"/api/v1/data/uploads/{uuid.uuid4()}")
    assert res.status_code == 404
    assert res.json()["error"]["type"] == "NOT_FOUND"


def test_undo_rejects_malformed_id():
    assert client.delete("/api/v1/data/uploads/not-a-uuid").status_code == 422
