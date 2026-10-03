"""Model tiers by history length: selection, fit/predict, persistence and simulation."""

import math
from datetime import date, timedelta

import numpy as np
import pytest

from src.config import settings
from src.infrastructure.ml import prophet_forecaster
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.infrastructure.ml.prophet_forecaster import ProphetForecaster
from src.infrastructure.ml.tier_models import (
    LGBM_MIN_POINTS,
    LINEAR_MAX_POINTS,
    LinearTierModel,
    ProphetLgbmModel,
    select_tier,
)

DATASET = "00000000-0000-0000-0000-0000000000b7"


def _rows(days: int, seed: int = 0) -> list[dict]:
    rng = np.random.default_rng(seed)
    base = date(2025, 1, 1)
    out = []
    for d in range(days):
        marketing = 100 + 20 * math.sin(d / 5) + rng.normal(0, 3)
        price = 10 + rng.normal(0, 0.4)
        weekly = 8 * math.sin(2 * math.pi * (d % 7) / 7)
        out.append(
            {
                "date": (base + timedelta(days=d)).isoformat(),
                "actual": 200 + 0.1 * d + weekly + 0.5 * marketing - 6 * price + rng.normal(0, 1.5),
                "marketing_spend": marketing,
                "unit_price": price,
            }
        )
    return out


@pytest.fixture
def storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ML_MODELS_DIR", str(tmp_path / "models"))
    prophet_forecaster.clear_model_cache()
    yield JsonModelStorage()
    prophet_forecaster.clear_model_cache()


def test_tier_selection_thresholds():
    assert select_tier(30) == select_tier(LINEAR_MAX_POINTS - 1) == "linear"
    assert select_tier(LINEAR_MAX_POINTS) == select_tier(LGBM_MIN_POINTS - 1) == "prophet"
    assert select_tier(LGBM_MIN_POINTS) == select_tier(2000) == "prophet_lgbm"


def test_linear_model_recovers_structure_and_exposes_prophet_interface():
    import pandas as pd

    df = pd.DataFrame(_rows(50)).rename(columns={"date": "ds", "actual": "y"})
    df["ds"] = pd.to_datetime(df["ds"])
    model = LinearTierModel().fit(df, ["marketing_spend", "unit_price"])

    future = model.make_future_dataframe(7)
    assert len(future) == 57
    future["marketing_spend"], future["unit_price"] = 100.0, 10.0
    out = model.predict(future)
    assert {"yhat", "yhat_lower", "yhat_upper", "trend", "weekly", "marketing_spend", "unit_price"} <= set(out.columns)
    assert (out["yhat_lower"] < out["yhat"]).all() and (out["yhat"] < out["yhat_upper"]).all()
    # marketing raises demand, price lowers it: component signs follow the true coefficients
    assert out["marketing_spend"].diff().abs().max() < 1e-9  # constant lever -> constant contribution
    hi = future.copy(); hi["marketing_spend"] = 140.0
    assert model.predict(hi)["yhat"].iloc[-1] > out["yhat"].iloc[-1]
    lo = future.copy(); lo["unit_price"] = 13.0
    assert model.predict(lo)["yhat"].iloc[-1] < out["yhat"].iloc[-1]

    restored = LinearTierModel.from_dict(model.to_dict())
    assert np.allclose(restored.predict(future)["yhat"], out["yhat"])


@pytest.mark.asyncio
async def test_forecaster_uses_linear_tier_for_short_history(storage):
    f = ProphetForecaster(storage)
    await f.train(_rows(45), dataset_id=DATASET)
    info = storage.get_latest_model_info(dataset_id=DATASET)
    assert info["metadata"]["model_tier"] == "linear"

    forecast = await f.predict(7, dataset_id=DATASET)
    assert len(forecast) == 7 and all(p.predicted >= 0 for p in forecast)

    # a fresh process loads the stored linear model and predicts identically
    prophet_forecaster.clear_model_cache()
    reloaded = ProphetForecaster(JsonModelStorage())
    again = await reloaded.predict(7, dataset_id=DATASET)
    assert [round(p.predicted, 6) for p in again] == [round(p.predicted, 6) for p in forecast]

    up = await reloaded.simulate_scenario(14, {"marketing_spend": 0.3}, dataset_id=DATASET)
    down = await reloaded.simulate_scenario(14, {"marketing_spend": -0.3}, dataset_id=DATASET)
    assert up.total_delta > 0 > down.total_delta

    bt = await f.backtest(_rows(60), test_days=10)
    assert bt["model_tier"] == "prophet"  # 60 points is the Prophet tier
    bt_short = await f.backtest(_rows(45), test_days=10)
    assert bt_short["model_tier"] == "linear" and bt_short["mae"] >= 0


@pytest.fixture(scope="module")
def lgbm_setup(tmp_path_factory):
    settings_dir = tmp_path_factory.mktemp("lgbm_models")
    original = settings.ML_MODELS_DIR
    settings.ML_MODELS_DIR = str(settings_dir)
    prophet_forecaster.clear_model_cache()
    yield JsonModelStorage()
    settings.ML_MODELS_DIR = original
    prophet_forecaster.clear_model_cache()


@pytest.mark.asyncio
async def test_long_history_uses_prophet_plus_lightgbm(lgbm_setup):
    storage = lgbm_setup
    f = ProphetForecaster(storage)
    await f.train(_rows(400), dataset_id=DATASET)
    assert storage.get_latest_model_info(dataset_id=DATASET)["metadata"]["model_tier"] == "prophet_lgbm"
    assert isinstance(f.model, ProphetLgbmModel)

    forecast = await f.predict(14, dataset_id=DATASET)
    assert len(forecast) == 14 and all(math.isfinite(p.predicted) for p in forecast)

    # persistence round trip through storage reproduces the forecast
    prophet_forecaster.clear_model_cache()
    reloaded = ProphetForecaster(JsonModelStorage())
    again = await reloaded.predict(14, dataset_id=DATASET)
    assert isinstance(reloaded.model, ProphetLgbmModel)
    assert [round(p.predicted, 4) for p in again] == [round(p.predicted, 4) for p in forecast]

    # the residual stage reacts to the levers: mutations change the scenario
    sim = await reloaded.simulate_scenario(14, {"marketing_spend": 0.3}, dataset_id=DATASET)
    assert sim.total_delta > 0

    out = reloaded.model.predict(reloaded._build_future(reloaded.model, 14))
    assert "lgbm_residual" in out.columns and out["lgbm_residual"].iloc[-14:].abs().sum() > 0

    bt = await f.backtest(_rows(400), test_days=14)
    assert bt["model_tier"] == "prophet_lgbm" and bt["mae"] >= 0
