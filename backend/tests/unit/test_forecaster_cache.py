"""The forecaster cache is process-wide and notices retrains done elsewhere."""

from datetime import date, timedelta

import pytest

from src.config import settings
from src.infrastructure.ml import prophet_forecaster
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.infrastructure.ml.prophet_forecaster import ProphetForecaster

DATASET = "00000000-0000-0000-0000-000000000001"


def _rows(days: int = 40, level: float = 100.0) -> list[dict]:
    base = date(2026, 1, 1)
    return [
        {"date": (base + timedelta(days=d)).isoformat(), "sales_volume": level + (d % 7), "marketing_spend": 50.0 + d % 3}
        for d in range(days)
    ]


@pytest.fixture
def storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ML_MODELS_DIR", str(tmp_path / "models"))
    prophet_forecaster.clear_model_cache()
    yield JsonModelStorage()
    prophet_forecaster.clear_model_cache()


@pytest.mark.asyncio
async def test_retrain_in_one_instance_is_seen_by_another(storage):
    worker_a = ProphetForecaster(storage)
    worker_b = ProphetForecaster(JsonModelStorage())

    first_id = await worker_a.train(_rows(), dataset_id=DATASET)
    assert await worker_b.is_trained(dataset_id=DATASET)
    first_model = worker_b.model

    second_id = await worker_a.train(_rows(level=500.0), dataset_id=DATASET)
    assert second_id != first_id

    assert await worker_b.is_trained(dataset_id=DATASET)
    assert worker_b.model is not first_model
    assert worker_b.model is worker_a.model


@pytest.mark.asyncio
async def test_cache_hit_skips_reading_model_file(storage, monkeypatch):
    forecaster = ProphetForecaster(storage)
    await forecaster.train(_rows(), dataset_id=DATASET)

    calls = []
    original = storage.load_model
    monkeypatch.setattr(storage, "load_model", lambda model_id: calls.append(model_id) or original(model_id))

    other = ProphetForecaster(storage)
    assert await other.is_trained(dataset_id=DATASET)
    assert await other.is_trained(dataset_id=DATASET)
    assert calls == []


@pytest.mark.asyncio
async def test_cold_process_loads_once_then_hits_cache(storage, monkeypatch):
    await ProphetForecaster(storage).train(_rows(), dataset_id=DATASET)
    prophet_forecaster.clear_model_cache()

    calls = []
    original = storage.load_model
    monkeypatch.setattr(storage, "load_model", lambda model_id: calls.append(model_id) or original(model_id))

    for _ in range(3):
        assert await ProphetForecaster(storage).is_trained(dataset_id=DATASET)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_unknown_dataset_is_not_trained(storage):
    assert not await ProphetForecaster(storage).is_trained(dataset_id="no-such-dataset")
