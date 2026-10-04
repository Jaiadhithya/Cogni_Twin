"""Every model tier explains a forecast day as trend level + factor amounts that add up to it."""

import asyncio
import math
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from src.config import settings
from src.infrastructure.ml import prophet_forecaster
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.infrastructure.ml.prophet_forecaster import ProphetForecaster
from src.infrastructure.ml.components import MOMENTUM, contributions
from src.infrastructure.ml.shap_engine import METHOD_DECOMPOSITION, METHOD_LINEAR, ShapEngine

DATASET = "00000000-0000-0000-0000-0000000000c8"


def _rows(days: int, seed: int = 3) -> list[dict]:
    rng = np.random.default_rng(seed)
    base = date(2025, 1, 1)
    out = []
    for d in range(days):
        marketing = 100 + 20 * math.sin(d / 5) + rng.normal(0, 3)
        price = 10 + rng.normal(0, 0.4)
        out.append(
            {
                "date": (base + timedelta(days=d)).isoformat(),
                "actual": 200 + 0.1 * d + 8 * math.sin(2 * math.pi * (d % 7) / 7) + 0.5 * marketing - 6 * price + rng.normal(0, 1.5),
                "marketing_spend": marketing,
                "unit_price": price,
            }
        )
    return out


@pytest.fixture
def isolated_models(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ML_MODELS_DIR", str(tmp_path / "models"))
    prophet_forecaster.clear_model_cache()
    yield
    prophet_forecaster.clear_model_cache()


async def _trained(days: int) -> ProphetForecaster:
    f = ProphetForecaster(JsonModelStorage())
    await f.train(_rows(days), dataset_id=DATASET)
    return f


async def _explain_last_day(days: int):
    f = await _trained(days)
    df = f.model.predict(f.future_frame(14))
    target = df["ds"].iloc[-1].strftime("%Y-%m-%d")
    return f, df, await ShapEngine().compute_explanation(f.model, df, target)


@pytest.mark.asyncio
@pytest.mark.parametrize("days, tier", [(45, "linear"), (100, "prophet"), (400, "prophet_lgbm")])
async def test_factors_add_up_to_the_forecast(isolated_models, days, tier):
    f, df, explanation = await _explain_last_day(days)
    assert getattr(f.model, "tier", "prophet") == tier

    parts = contributions(f.model, df)
    total = df["trend"].iloc[-1] + sum(series.iloc[-1] for series in parts.values())
    assert total == pytest.approx(df["yhat"].iloc[-1], rel=1e-6)
    assert explanation.base_value == pytest.approx(df["trend"].iloc[-1], abs=0.01)
    assert explanation.predicted_value == pytest.approx(df["yhat"].iloc[-1], abs=0.01)
    assert explanation.method == (METHOD_LINEAR if tier == "linear" else METHOD_DECOMPOSITION)


@pytest.mark.asyncio
async def test_multiplicative_effects_are_amounts_not_fractions(isolated_models):
    # The synthetic weekly swing is about ±8 on a ~250 level; as a raw fraction it would be ~0.03.
    f, df, explanation = await _explain_last_day(100)
    weekly = contributions(f.model, df)["weekly"]
    assert weekly.abs().max() > 2.0
    drivers = explanation.top_positive_drivers + explanation.top_negative_drivers
    assert all(d.feature != "trend" for d in drivers)
    assert all(d.contribution > 0 for d in explanation.top_positive_drivers)
    assert all(d.contribution < 0 for d in explanation.top_negative_drivers)


@pytest.mark.asyncio
async def test_lgbm_tier_reports_its_correction_as_recent_momentum(isolated_models):
    f, df, _ = await _explain_last_day(400)
    parts = contributions(f.model, df)
    assert MOMENTUM in parts
    assert parts[MOMENTUM].iloc[-1] == pytest.approx(df["lgbm_residual"].iloc[-1])


@pytest.mark.asyncio
@pytest.mark.parametrize("days", [100, 400])
async def test_what_if_rows_are_amounts_that_add_up_to_the_total(isolated_models, days):
    f = await _trained(days)
    result = await f.simulate_scenario(30, {"marketing_spend": "+20%"}, dataset_id=DATASET)

    marketing = next(x for x in result.shap_forces if x["feature"] == "marketing_spend")
    assert marketing["delta_force"] > 1.0  # +20% marketing over 30 days on a ~250/day series: amounts, not fractions
    assert sum(x["delta_force"] for x in result.shap_forces) == pytest.approx(result.total_delta, abs=max(1.0, 0.006 * abs(result.baseline_total)))
