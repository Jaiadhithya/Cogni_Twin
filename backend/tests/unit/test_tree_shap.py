"""TreeSHAP for the Prophet + LightGBM tier; honest method labels for the other tiers."""

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
from src.infrastructure.ml.shap_engine import (
    METHOD_DECOMPOSITION,
    METHOD_LINEAR,
    METHOD_TREE_SHAP,
    ShapEngine,
)

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


@pytest.mark.asyncio
async def test_tree_shap_is_exact_and_labelled(isolated_models):
    import shap

    f = await _trained(400)
    future = f._build_future(f.model, 14)
    df = f.model.predict(future)
    target = df["ds"].iloc[-1]
    explanation = await ShapEngine().compute_explanation(f.model, df, target.strftime("%Y-%m-%d"))

    assert explanation.method == METHOD_TREE_SHAP and "TreeSHAP" in explanation.method_note
    drivers = explanation.top_positive_drivers + explanation.top_negative_drivers
    assert drivers and {d.feature for d in drivers} <= set(f.model.feature_names)
    assert all(d.contribution > 0 for d in explanation.top_positive_drivers)
    assert all(d.contribution < 0 for d in explanation.top_negative_drivers)

    # Shapley additivity: expected value + sum of SHAP values == the residual stage's output
    row = df.attrs["stage2_features"].iloc[[len(df) - 1]].to_numpy(dtype=float)
    ex = shap.TreeExplainer(f.model.booster)
    total = float(np.ravel(ex.expected_value)[0]) + float(np.sum(ex.shap_values(row)))
    assert total == pytest.approx(float(df["lgbm_residual"].iloc[-1]), abs=1e-6)
    # base_value is Prophet's forecast plus the correction's average, so base + sum(SHAP) is the forecast
    shap_sum = float(np.sum(ex.shap_values(row)))
    assert explanation.base_value + shap_sum == pytest.approx(explanation.predicted_value, abs=0.02)


@pytest.mark.asyncio
async def test_tree_shap_rejects_dates_inside_training_window(isolated_models):
    from src.domain.exceptions import MlError

    f = await _trained(400)
    df = f.model.predict(f._build_future(f.model, 7))
    inside = df["ds"].iloc[10].strftime("%Y-%m-%d")
    with pytest.raises(MlError):
        await ShapEngine().compute_explanation(f.model, df, inside)


@pytest.mark.asyncio
async def test_linear_tier_is_labelled_linear_coefficients_and_exact(isolated_models):
    f = await _trained(45)
    df = f.model.predict(f._build_future(f.model, 7))
    target = df["ds"].iloc[-1].strftime("%Y-%m-%d")
    explanation = await ShapEngine().compute_explanation(f.model, df, target)

    assert explanation.method == METHOD_LINEAR and "add up exactly" in explanation.method_note
    components = df.iloc[-1][["trend", "weekly", "marketing_spend", "unit_price"]].sum()
    assert components == pytest.approx(df["yhat"].iloc[-1], abs=1e-6)


@pytest.mark.asyncio
async def test_prophet_tier_keeps_component_decomposition(isolated_models):
    f = await _trained(100)
    df = f.model.predict(f._build_future(f.model, 7))
    explanation = await ShapEngine().compute_explanation(f.model, df, df["ds"].iloc[-1].strftime("%Y-%m-%d"))
    assert explanation.method == METHOD_DECOMPOSITION
