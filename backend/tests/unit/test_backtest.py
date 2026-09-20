"""Unit tests for the ProphetForecaster backtest (MAE/MAPE/RMSE)."""

import math
from datetime import date, timedelta

import pytest

from src.infrastructure.ml.prophet_forecaster import ProphetForecaster
from src.domain.exceptions import MlError
from src.infrastructure.ml.model_storage import JsonModelStorage


@pytest.fixture
def forecaster(tmp_path):
    storage = JsonModelStorage()
    storage.models_dir = str(tmp_path / "ml_models")
    return ProphetForecaster(storage=storage)


def _series(days: int, start: float = 100.0, drift: float = 1.0) -> list[dict]:
    """Deterministic daily series with a mild upward drift."""
    base = date(2026, 1, 1)
    return [
        {"date": (base + timedelta(days=d)).isoformat(), "actual": start + drift * d}
        for d in range(days)
    ]


@pytest.mark.asyncio
async def test_backtest_returns_metrics_for_sufficient_data(forecaster):
    data = _series(60)
    result = await forecaster.backtest(data, test_days=7)

    assert result["test_days"] == 7
    assert result["train_points"] == 53
    assert result["test_start"] == (date(2026, 1, 1) + timedelta(days=53)).isoformat()
    assert result["test_end"] == (date(2026, 1, 1) + timedelta(days=59)).isoformat()
    assert result["mae"] >= 0.0
    assert math.isfinite(result["mae"])
    assert math.isfinite(result["rmse"])
    # A perfectly linear series is well captured by a linear Prophet model, so
    # error should be small relative to the level of the series.
    assert result["mape"] is None or result["mape"] < 0.5


@pytest.mark.asyncio
async def test_backtest_rejects_tiny_holdout(forecaster):
    with pytest.raises(MlError):
        await forecaster.backtest(_series(60), test_days=2)


@pytest.mark.asyncio
async def test_backtest_rejects_insufficient_history(forecaster):
    # min training points (30) + 14 holdout = 44 required
    with pytest.raises(MlError):
        await forecaster.backtest(_series(20), test_days=14)


@pytest.mark.asyncio
async def test_backtest_does_not_clobber_active_model(forecaster, monkeypatch):
    """The throwaway backtest model must never be persisted or become active."""
    saved = []
    monkeypatch.setattr(
        forecaster.storage, "save_model", lambda *a, **k: saved.append(a) or "saved"
    )

    await forecaster.backtest(_series(60), test_days=7)

    assert saved == [], "backtest must not persist its throwaway model"
    assert forecaster.model is None
