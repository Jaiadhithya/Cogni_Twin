"""Forecast components expressed in the target's own units (₹ for revenue).

Prophet with multiplicative seasonality reports seasonal and regressor components as fractions
of the trend (0.05 = +5%), so ``yhat = trend * (1 + sum(multiplicative)) + sum(additive)``. Read
raw, those fractions look like near-zero amounts. Multiplying each by the trend turns every
component into an amount that adds up exactly to the forecast, with the trend as the base.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

MOMENTUM = "recent_momentum"
MOMENTUM_LABEL = "Recent momentum"


def _prophet_of(model: Any) -> Any:
    return getattr(model, "prophet", model)


def component_names(model: Any, frame: pd.DataFrame) -> list[str]:
    """Components of ``frame`` other than the trend: seasonalities, holidays and regressors."""
    prophet = _prophet_of(model)
    names = list(getattr(prophet, "seasonalities", {}) or {})
    if "holidays" in frame.columns:
        names.append("holidays")
    regressors = getattr(prophet, "extra_regressors", None)
    names += list(regressors) if regressors is not None else list(getattr(model, "regressors", []))
    if not hasattr(prophet, "seasonalities") and "weekly" in frame.columns:
        names.insert(0, "weekly")  # linear tier: day-of-week dummies
    return [n for n in dict.fromkeys(names) if n in frame.columns]


def is_multiplicative(model: Any, name: str) -> bool:
    prophet = _prophet_of(model)
    regressors = getattr(prophet, "extra_regressors", None) or {}
    if name in regressors:
        return regressors[name].get("mode") == "multiplicative"
    seasonalities = getattr(prophet, "seasonalities", None) or {}
    if name in seasonalities:
        return seasonalities[name].get("mode") == "multiplicative"
    return getattr(prophet, "seasonality_mode", "additive") == "multiplicative" and hasattr(prophet, "seasonalities")


def in_units(model: Any, frame: pd.DataFrame, name: str) -> pd.Series:
    """Component ``name`` of a prediction frame as an amount in the target's units."""
    values = frame[name].astype(float)
    return values * frame["trend"].astype(float) if is_multiplicative(model, name) else values


def contributions(model: Any, frame: pd.DataFrame) -> dict[str, pd.Series]:
    """Every component except the trend, in target units; ``trend + sum(...) == yhat``."""
    out = {name: in_units(model, frame, name) for name in component_names(model, frame)}
    if "lgbm_residual" in frame.columns:
        out[MOMENTUM] = frame["lgbm_residual"].astype(float)
    return out
