"""Project exogenous regressors over the forecast horizon.

Holding every regressor at its last observed value flattens real trends and lets
one noisy final observation drive the whole baseline. Each column instead gets a
strategy chosen at train time and stored in the model metadata:

* ``linear``      - the history has a clear linear trend; extrapolate it, clipped to
                    the observed range widened by a modest margin.
* ``window_mean`` - otherwise, the mean of the most recent observations.

Models saved before this existed carry no plan; callers fall back to the last value.
"""

from __future__ import annotations

from typing import Any

import numpy as np

WINDOW = 28
MIN_POINTS_FOR_TREND = 14
MIN_R2 = 0.5
MIN_ABS_T = 3.0  # slope t-statistic; roughly p < 0.003 for the sample sizes we see
RANGE_MARGIN = 0.10  # widen the observed [min, max] by 10% of its span on each side


def plan_projection(values: np.ndarray) -> dict[str, Any]:
    """Choose a projection strategy for one regressor from its chronological history."""
    values = np.asarray(values, dtype=float)
    n = len(values)
    window_mean = float(np.mean(values[-WINDOW:])) if n else 0.0
    plan: dict[str, Any] = {"strategy": "window_mean", "value": window_mean}
    if n < MIN_POINTS_FOR_TREND or np.ptp(values) < 1e-12:
        return plan

    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, values, 1)
    residuals = values - (slope * x + intercept)
    ss_res = float(np.sum(residuals ** 2))
    ss_tot = float(np.sum((values - values.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    sxx = float(np.sum((x - x.mean()) ** 2))
    se = np.sqrt(ss_res / (n - 2) / sxx) if n > 2 and sxx > 0 else np.inf
    t_stat = abs(slope) / se if se > 0 else np.inf

    if r2 >= MIN_R2 and t_stat >= MIN_ABS_T:
        lo, hi = float(values.min()), float(values.max())
        margin = RANGE_MARGIN * (hi - lo)
        lower = lo - margin
        if lo >= 0:
            lower = max(lower, 0.0)  # a non-negative lever (price, spend) stays non-negative
        plan = {
            "strategy": "linear",
            "slope": float(slope),
            "intercept": float(intercept),
            "n": n,
            "r2": round(float(r2), 4),
            "lower": lower,
            "upper": hi + margin,
            "value": window_mean,
        }
    return plan


def project(plan: dict[str, Any] | None, horizon: int, fallback: float = 0.0) -> np.ndarray:
    """Return ``horizon`` projected values; a missing plan means the legacy flat last value."""
    if not plan:
        return np.full(horizon, float(fallback))
    if plan.get("strategy") == "linear":
        steps = plan["n"] - 1 + np.arange(1, horizon + 1, dtype=float)
        raw = plan["slope"] * steps + plan["intercept"]
        return np.clip(raw, plan["lower"], plan["upper"])
    return np.full(horizon, float(plan.get("value", fallback)))
