"""Unit tests for atomic + locked model storage writes."""

import json
import os
import threading
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.infrastructure.ml.model_storage import JsonModelStorage


@pytest.fixture
def storage(tmp_path):
    fake_settings = SimpleNamespace(ML_MODELS_DIR=str(tmp_path))
    with patch("src.infrastructure.ml.model_storage.settings", fake_settings):
        yield JsonModelStorage()


def test_registry_initialized_on_construction(storage):
    assert os.path.exists(storage.registry_path)
    registry = json.load(open(storage.registry_path))
    assert registry == {"latest_model": None, "history": [], "by_dataset": {}}


def test_atomic_write_leaves_no_temp_files(storage):
    target = os.path.join(storage.models_dir, "payload.json")
    storage._atomic_write(target, '{"ok": true}')
    assert json.load(open(target)) == {"ok": True}
    leftovers = [f for f in os.listdir(storage.models_dir) if f.endswith(".tmp")]
    assert leftovers == []


def test_registry_update_and_lookup(storage):
    storage._update_registry("model-1", {"dataset_id": "ds-1"})
    info = storage.get_latest_model_info()
    assert info["model_id"] == "model-1"
    assert storage.get_latest_model_info(dataset_id="ds-1")["model_id"] == "model-1"


def test_concurrent_registry_updates_do_not_corrupt(storage):
    n = 40
    barrier = threading.Barrier(n)

    def writer(i):
        barrier.wait()
        with storage._write_lock:
            storage._update_registry(f"model-{i}", {"dataset_id": f"ds-{i}"})

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    registry = json.load(open(storage.registry_path))
    history_ids = {e["model_id"] for e in registry["history"]}
    assert len(history_ids) == n
    assert registry["latest_model"]["model_id"].startswith("model-")
