"""Gross profit and price-optimisation maths for what-if simulations.

Pure functions, no I/O. Nothing here guesses: a missing input yields an explicit
"unavailable" result with a reason, never a made-up cost or elasticity.

Sign convention: price elasticity of demand ``e`` is the log-log slope
``d ln Q / d ln P`` and is negative for ordinary goods (a 1% price rise cuts volume
by ``|e|`` %). The profit-maximising price under constant elasticity is
``P* = e / (e + 1) * cost`` and exists only for ``e < -1``.
"""

from __future__ import annotations

import re
from typing import Any, Optional, Sequence

import numpy as np

MIN_ELASTICITY_POINTS = 20
MIN_PRICE_LOG_STD = 0.02  # price must actually vary for its effect to be identified
MIN_ABS_T = 2.0
MIN_R2 = 0.10
CONTROL_POINTS_PER_PARAM = 8

_PRICE = re.compile(r"price", re.I)
_COST = re.compile(r"(^|_)(unit_?)?(cost|cogs)(_|$)|cost_price", re.I)
_MARKETING = re.compile(r"marketing|advert|promo|ad_?spend", re.I)
_UNITS = re.compile(r"unit|qty|quantity|volume|count|sold|orders", re.I)
_REVENUE = re.compile(r"revenue|amount|total|value|gmv", re.I)


def identify_columns(columns: Sequence[str], target_metric: Optional[str] = None) -> dict[str, Optional[str]]:
    """Pick the price / cost / marketing columns and decide whether the target is a unit count."""
    cols = [c for c in columns]
    cost = next((c for c in cols if _COST.search(c)), None)
    price_candidates = [c for c in cols if _PRICE.search(c) and c != cost and not _COST.search(c)]
    price = "unit_price" if "unit_price" in price_candidates else (price_candidates[0] if price_candidates else None)
    marketing = next((c for c in cols if _MARKETING.search(c)), None)
    target_is_units = bool(target_metric) and bool(_UNITS.search(target_metric)) and not _REVENUE.search(target_metric)
    return {"price": price, "cost": cost, "marketing": marketing, "target_is_units": target_is_units}


def estimate_price_elasticity(
    prices: Sequence[float],
    volumes: Sequence[float],
    controls: Optional[dict[str, Sequence[float]]] = None,
) -> dict[str, Any]:
    """Log-log OLS of volume on price, optionally controlling for other levers.

    Returns the fit statistics and ``usable`` / ``reason``. ``elasticity`` is reported
    whenever it can be computed, but only trust it when ``usable`` is true.
    """
    p = np.asarray(prices, dtype=float)
    q = np.asarray(volumes, dtype=float)
    keep = np.isfinite(p) & np.isfinite(q) & (p > 0) & (q > 0)
    n = int(keep.sum())
    base = {"elasticity": None, "std_err": None, "t_stat": None, "r2": None, "n": n, "controls": [], "usable": False}
    if n < MIN_ELASTICITY_POINTS:
        return {**base, "reason": f"Need at least {MIN_ELASTICITY_POINTS} observations with positive price and volume; found {n}."}

    ln_p, ln_q = np.log(p[keep]), np.log(q[keep])
    if float(np.std(ln_p)) < MIN_PRICE_LOG_STD:
        return {**base, "reason": "Price barely varies in the data, so its effect on volume cannot be estimated."}

    control_names: list[str] = []
    control_cols: list[np.ndarray] = []
    for name, series in (controls or {}).items():
        c = np.asarray(series, dtype=float)[keep]
        if np.all(np.isfinite(c)) and float(np.std(c)) > 1e-12:
            control_names.append(name)
            control_cols.append((c - c.mean()) / c.std())
    if control_cols and n < CONTROL_POINTS_PER_PARAM * (len(control_cols) + 2):
        control_names, control_cols = [], []  # too little data to afford the extra parameters

    def fit(columns: list[np.ndarray]):
        X = np.column_stack([np.ones(n), ln_p, *columns])
        if np.linalg.matrix_rank(X) < X.shape[1]:
            return None
        beta, *_ = np.linalg.lstsq(X, ln_q, rcond=None)
        resid = ln_q - X @ beta
        dof = n - X.shape[1]
        if dof <= 0:
            return None
        sigma2 = float(resid @ resid) / dof
        cov = sigma2 * np.linalg.inv(X.T @ X)
        ss_tot = float(np.sum((ln_q - ln_q.mean()) ** 2))
        r2 = 1.0 - float(resid @ resid) / ss_tot if ss_tot > 0 else 0.0
        return float(beta[1]), float(np.sqrt(cov[1, 1])), r2

    result = fit(control_cols)
    if result is None and control_cols:
        control_names = []
        result = fit([])
    if result is None:
        return {**base, "reason": "Regression is degenerate for this data."}

    elasticity, se, r2 = result
    t_stat = elasticity / se if se > 0 else float("inf")
    usable, reason = True, None
    if abs(t_stat) < MIN_ABS_T:
        usable, reason = False, "Estimated elasticity is not statistically distinguishable from zero (|t| < 2)."
    elif r2 < MIN_R2:
        usable, reason = False, f"Poor fit (R² {r2:.2f} < {MIN_R2})."
    return {
        "elasticity": round(elasticity, 4),
        "std_err": round(se, 4),
        "t_stat": round(t_stat, 2),
        "r2": round(r2, 4),
        "n": n,
        "controls": control_names,
        "usable": usable,
        "reason": reason,
    }


def profit_maximising_price(
    fit: dict[str, Any],
    unit_cost: Optional[float],
    observed_price_range: Optional[tuple[float, float]] = None,
) -> dict[str, Any]:
    """``P* = e / (e + 1) * cost`` for a usable fit with ``e < -1``; otherwise null with a reason."""
    if unit_cost is None or unit_cost <= 0:
        return {"price": None, "reason": "No unit cost available."}
    if not fit.get("usable"):
        return {"price": None, "reason": fit.get("reason") or "Elasticity estimate is not reliable."}
    e = fit["elasticity"]
    if e >= -1:
        return {
            "price": None,
            "reason": f"Demand is inelastic (elasticity {e} >= -1); profit keeps rising with price, so no finite optimum exists.",
        }
    price = e / (e + 1.0) * unit_cost
    out: dict[str, Any] = {"price": round(price, 4), "reason": None, "elasticity": e, "unit_cost": unit_cost}
    if observed_price_range:
        lo, hi = observed_price_range
        out["observed_price_range"] = [round(lo, 4), round(hi, 4)]
        out["extrapolated"] = not (lo <= price <= hi)
    return out


def gross_profit(
    volume: Sequence[float], price: Sequence[float], unit_cost: Sequence[float], marketing: Sequence[float]
) -> float:
    """``GP = sum(Q*P - Q*cost - marketing)`` over the horizon."""
    q = np.asarray(volume, dtype=float)
    return float(np.sum(q * np.asarray(price, dtype=float) - q * np.asarray(unit_cost, dtype=float) - np.asarray(marketing, dtype=float)))


def profit_report(
    baseline_volume: Sequence[float],
    simulated_volume: Sequence[float],
    baseline_paths: dict[str, Sequence[float]],
    simulated_paths: dict[str, Sequence[float]],
    columns: dict[str, Optional[str]],
    request_unit_cost: Optional[float] = None,
) -> dict[str, Any]:
    """Gross profit for baseline vs scenario, or an explicit unavailable state."""

    def unavailable(reason: str) -> dict[str, Any]:
        return {"available": False, "reason": reason, "profit": None}

    if not columns.get("target_is_units"):
        return unavailable("The forecast target is not a unit volume, so gross profit (volume x price - volume x cost) cannot be computed.")
    price_col, cost_col, mkt_col = columns.get("price"), columns.get("cost"), columns.get("marketing")
    if not price_col or price_col not in baseline_paths:
        return unavailable("No price column was found among the model's levers.")

    horizon = len(baseline_volume)
    if request_unit_cost is not None:
        cost_source = "request_unit_cost"
        base_cost = sim_cost = [float(request_unit_cost)] * horizon
        cost_label = request_unit_cost
    elif cost_col and cost_col in baseline_paths:
        cost_source = f"dataset_column:{cost_col}"
        base_cost, sim_cost = baseline_paths[cost_col], simulated_paths[cost_col]
        cost_label = float(np.mean(base_cost))
    else:
        return unavailable("No cost data: the dataset has no cost column and the request gave no unit_cost.")

    zeros = [0.0] * horizon
    base_mkt = baseline_paths.get(mkt_col, zeros) if mkt_col else zeros
    sim_mkt = simulated_paths.get(mkt_col, zeros) if mkt_col else zeros

    base_gp = gross_profit(baseline_volume, baseline_paths[price_col], base_cost, base_mkt)
    sim_gp = gross_profit(simulated_volume, simulated_paths[price_col], sim_cost, sim_mkt)
    delta = sim_gp - base_gp
    volume_up = float(np.sum(simulated_volume)) > float(np.sum(baseline_volume))
    triggered = volume_up and sim_gp < base_gp

    assumptions = ["Each day's regressor value is treated as that day's per-unit price/cost and total marketing spend."]
    if not mkt_col:
        assumptions.append("No marketing column found; marketing spend counted as 0.")
    return {
        "available": True,
        "reason": None,
        "baseline_gross_profit": round(base_gp, 2),
        "simulated_gross_profit": round(sim_gp, 2),
        "delta": round(delta, 2),
        "delta_pct": round(delta / abs(base_gp) * 100.0, 2) if abs(base_gp) > 1e-9 else None,
        "unit_cost": round(float(cost_label), 4),
        "cost_source": cost_source,
        "price_column": price_col,
        "marketing_column": mkt_col,
        "margin_guardrail": {
            "triggered": triggered,
            "message": (
                "Volume rises but gross profit falls: the extra units do not cover the lower margin or added spend."
                if triggered
                else None
            ),
        },
        "assumptions": assumptions,
    }
