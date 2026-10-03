"""Regressors are projected forward, not frozen at their last observed value."""

from datetime import date, timedelta

import numpy as np
import pytest

from src.config import settings
from src.infrastructure.ml import prophet_forecaster
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.infrastructure.ml.prophet_forecaster import ProphetForecaster
from src.infrastructure.ml.regressor_projection import WINDOW, plan_projection, project

DATASET = "00000000-0000-0000-0000-0000000000a4"


def test_trending_series_is_extrapolated_and_clipped():
    values = 100.0 + 2.0 * np.arange(60) + np.random.default_rng(1).normal(0, 1.0, 60)
    plan = plan_projection(values)
    assert plan["strategy"] == "linear"

    projected = project(plan, 365)
    assert projected[0] > values[-1] - 5  # continues the climb rather than restarting
    assert projected[30] > projected[0]
    # a year out the raw line is far beyond the data; it must stop at observed range + margin
    span = values.max() - values.min()
    assert projected.max() == pytest.approx(values.max() + 0.10 * span)
    assert projected.max() < 100 + 2.0 * (60 + 365)


def test_declining_series_never_goes_negative():
    values = 50.0 - 0.8 * np.arange(60) + np.random.default_rng(2).normal(0, 0.3, 60)
    values = np.clip(values, 0.5, None)
    projected = project(plan_projection(values), 200)
    assert projected.min() >= 0.0


def test_flat_noisy_series_uses_recent_window_mean():
    rng = np.random.default_rng(3)
    values = 10.0 + rng.normal(0, 1.0, 120)
    values[-1] = 25.0  # an outlier final observation must not become the baseline
    plan = plan_projection(values)
    assert plan["strategy"] == "window_mean"
    assert plan["value"] == pytest.approx(values[-WINDOW:].mean())
    assert np.all(project(plan, 14) == plan["value"])


def test_missing_plan_falls_back_to_last_value():
    assert np.all(project(None, 5, fallback=7.5) == 7.5)


def _rows(days: int = 60, trending: bool = True) -> list[dict]:
    base = date(2026, 1, 1)
    return [
        {
            "date": (base + timedelta(days=d)).isoformat(),
            "sales_volume": 100.0 + (d % 7) + 0.1 * d,
            "marketing_spend": (100.0 + 3.0 * d) if trending else 100.0,
            "unit_price": 10.0,
        }
        for d in range(days)
    ]


@pytest.fixture
def forecaster(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ML_MODELS_DIR", str(tmp_path / "models"))
    prophet_forecaster.clear_model_cache()
    yield ProphetForecaster(JsonModelStorage())
    prophet_forecaster.clear_model_cache()


@pytest.mark.asyncio
async def test_training_stores_per_column_strategy_and_baseline_follows_it(forecaster):
    await forecaster.train(_rows(), dataset_id=DATASET)
    plans = forecaster._regressor_projection
    assert plans["marketing_spend"]["strategy"] == "linear"
    assert plans["unit_price"]["strategy"] == "window_mean"

    future = forecaster._build_future(forecaster.model, 10)
    tail = future.tail(10)
    assert tail["marketing_spend"].is_monotonic_increasing
    assert tail["marketing_spend"].iloc[-1] > forecaster._last_regressor_values["marketing_spend"]
    assert (tail["unit_price"] == 10.0).all()


@pytest.mark.asyncio
async def test_mutation_applies_on_top_of_projected_baseline(forecaster):
    await forecaster.train(_rows(), dataset_id=DATASET)
    base = forecaster._build_future(forecaster.model, 10).tail(10)["marketing_spend"].to_numpy()
    mutated = forecaster._build_future(forecaster.model, 10, {"marketing_spend": 0.2}).tail(10)["marketing_spend"].to_numpy()
    assert mutated == pytest.approx(base * 1.2)


@pytest.mark.asyncio
async def test_simulation_delta_has_expected_sign_for_flat_regressors(forecaster):
    await forecaster.train(_rows(trending=False), dataset_id=DATASET)
    up = await forecaster.simulate_scenario(14, {"marketing_spend": 0.3}, dataset_id=DATASET)
    down = await forecaster.simulate_scenario(14, {"marketing_spend": -0.3}, dataset_id=DATASET)
    # Training data has no spend variation, so the lever has ~no effect; deltas must be
    # opposite in sign (or zero) and mirror each other in magnitude.
    assert up.total_delta * down.total_delta <= 1e-6
    assert up.total_delta == pytest.approx(-down.total_delta, abs=max(1.0, abs(up.total_delta) * 0.5))


@pytest.mark.asyncio
async def test_legacy_model_metadata_without_projection_still_works(forecaster):
    await forecaster.train(_rows(), dataset_id=DATASET)
    info = forecaster.storage.get_latest_model_info(dataset_id=DATASET)
    legacy_meta = {k: v for k, v in info["metadata"].items() if k != "regressor_projection"}

    prophet_forecaster.clear_model_cache()
    fresh = ProphetForecaster(forecaster.storage)
    fresh.storage.get_latest_model_info = lambda dataset_id=None: {**info, "metadata": legacy_meta}
    assert await fresh.is_trained(dataset_id=DATASET)
    assert fresh._regressor_projection == {}

    tail = fresh._build_future(fresh.model, 5).tail(5)
    assert (tail["marketing_spend"] == legacy_meta["last_regressor_values"]["marketing_spend"]).all()
    forecast = await fresh.predict(5, dataset_id=DATASET)
    assert len(forecast) == 5
