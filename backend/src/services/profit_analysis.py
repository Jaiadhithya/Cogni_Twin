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

# Average ticket / order value is a price per order: revenue / ticket = orders.
_PRICE = re.compile(r"price|ticket|order_value|aov", re.I)
_COST = re.compile(r"(^|_)(unit_?)?(cost|cogs)(_|$)|cost_price", re.I)
_MARKETING = re.compile(r"marketing|advert|promo|ad_?spend", re.I)
_SPEND = re.compile(r"spend|budget|marketing|advert", re.I)
_NOT_MONEY = re.compile(r"pct|percent|discount|rate|share", re.I)
_UNITS = re.compile(r"unit|qty|quantity|volume|count|sold|orders", re.I)
_REVENUE = re.compile(r"revenue|amount|total|value|gmv", re.I)
_MONEY = re.compile(r"revenue|sales|amount|total|value|gmv|turnover|income", re.I)

VOLUME_UNITS = "units"
VOLUME_IMPLIED = "revenue_over_price"


def identify_columns(columns: Sequence[str], target_metric: Optional[str] = None) -> dict[str, Optional[str]]:
    """Pick the price / cost / marketing columns and decide whether the target is a unit count."""
    cols = [c for c in columns]
    cost = next((c for c in cols if _COST.search(c)), None)
    price_candidates = [c for c in cols if _PRICE.search(c) and c != cost and not _COST.search(c)]
    price = "unit_price" if "unit_price" in price_candidates else (price_candidates[0] if price_candidates else None)
    # A promo discount (%) is not money spent; prefer columns that are clearly spend.
    spend_like = [c for c in cols if _MARKETING.search(c) and not _NOT_MONEY.search(c)]
    marketing = next((c for c in spend_like if _SPEND.search(c)), spend_like[0] if spend_like else None)
    target_is_units = bool(target_metric) and bool(_UNITS.search(target_metric)) and not _REVENUE.search(target_metric)
    target_is_revenue = bool(target_metric) and not target_is_units and bool(_MONEY.search(target_metric))
    return {
        "price": price,
        "cost": cost,
        "marketing": marketing,
        "target_is_units": target_is_units,
        "target_is_revenue": target_is_revenue,
    }


def volume_basis(columns: dict[str, Any]) -> Optional[str]:
    """How unit volume is obtained: the target itself, revenue / price, or not at all (None)."""
    if columns.get("target_is_units"):
        return VOLUME_UNITS
    if columns.get("target_is_revenue") and columns.get("price"):
        return VOLUME_IMPLIED
    return None


def implied_volume(revenue: Sequence[float], price: Sequence[float]) -> list[float]:
    """Units sold estimated as revenue / price (0 where the price is not positive)."""
    return [float(r) / float(p) if p and p > 0 else 0.0 for r, p in zip(revenue, price)]


def calendar_controls(dates: Sequence[Any]) -> dict[str, np.ndarray]:
    """Growth, weekday and (with a year of data) time-of-year terms.

    Without them price is confounded with everything else that moves over time: prices that
    rise as the business grows would read as "higher price, more sales".
    """
    ds = np.asarray(dates, dtype="datetime64[D]")
    days = (ds - ds.min()).astype(float)
    out: dict[str, np.ndarray] = {"trend": days}
    dow = (ds.view("int64") + 3) % 7  # 1970-01-01 was a Thursday; Monday = 0
    for k in range(1, 7):
        out[f"weekday_{k}"] = (dow == k).astype(float)
    if days.max() >= 365:
        doy = 2 * np.pi * days / 365.25
        for k in (1, 2):
            out[f"year_sin_{k}"], out[f"year_cos_{k}"] = np.sin(k * doy), np.cos(k * doy)
    return out


def estimate_price_elasticity(
    prices: Sequence[float],
    volumes: Sequence[float],
    controls: Optional[dict[str, Sequence[float]]] = None,
    dates: Optional[Sequence[Any]] = None,
) -> dict[str, Any]:
    """Log-log OLS of volume on price, optionally controlling for other levers.

    With ``dates`` the fit always controls for growth, weekday and time of year as well
    (see ``calendar_controls``); the lever controls are dropped first if data is short.

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

    def standardised(series_by_name: dict[str, Any]) -> tuple[list[str], list[np.ndarray]]:
        names, cols = [], []
        for name, series in series_by_name.items():
            c = np.asarray(series, dtype=float)[keep]
            if np.all(np.isfinite(c)) and float(np.std(c)) > 1e-12:
                names.append(name)
                cols.append((c - c.mean()) / c.std())
        return names, cols

    calendar_names, calendar_cols = standardised(calendar_controls(dates) if dates is not None else {})
    lever_names, lever_cols = standardised(controls or {})
    if lever_cols and n < CONTROL_POINTS_PER_PARAM * (len(lever_cols) + len(calendar_cols) + 2):
        lever_names, lever_cols = [], []  # too little data to afford the extra parameters
    control_names, control_cols = calendar_names + lever_names, calendar_cols + lever_cols

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
    if result is None and lever_cols:
        control_names = calendar_names
        result = fit(calendar_cols)
    if result is None and control_names:
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
    basis: Optional[str] = None,
    marketing_scale: float = 1.0,
) -> dict[str, Any]:
    """Gross profit for baseline vs scenario, or an explicit unavailable state.

    ``baseline_volume``/``simulated_volume`` are unit volumes; for a revenue target pass the
    implied volumes (``basis=VOLUME_IMPLIED``). ``marketing_scale`` turns the per-row average
    marketing value into a daily total.
    """

    def unavailable(reason: str) -> dict[str, Any]:
        return {"available": False, "reason": reason, "profit": None}

    basis = basis or volume_basis(columns)
    if basis is None:
        return unavailable(
            "The forecast target is neither a unit count nor revenue with a price column, so units sold (and profit) cannot be worked out."
        )
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
        return unavailable("Enter a cost per unit above to see profit; this dataset has no cost column.")

    zeros = [0.0] * horizon
    base_mkt = [v * marketing_scale for v in baseline_paths.get(mkt_col, zeros)] if mkt_col else zeros
    sim_mkt = [v * marketing_scale for v in simulated_paths.get(mkt_col, zeros)] if mkt_col else zeros

    base_gp = gross_profit(baseline_volume, baseline_paths[price_col], base_cost, base_mkt)
    sim_gp = gross_profit(simulated_volume, simulated_paths[price_col], sim_cost, sim_mkt)
    delta = sim_gp - base_gp
    volume_up = float(np.sum(simulated_volume)) > float(np.sum(baseline_volume))
    triggered = volume_up and sim_gp < base_gp

    assumptions = ["Each day's regressor value is treated as that day's per-unit price/cost and total marketing spend."]
    if basis == VOLUME_IMPLIED:
        assumptions.append("Units sold are estimated as revenue / price, since the forecast is in revenue.")
    if not mkt_col:
        assumptions.append("No marketing column found; marketing spend counted as 0.")
    elif marketing_scale != 1.0:
        assumptions.append(f"Daily marketing spend is the per-row average x {marketing_scale:.1f} rows per day.")
    return {
        "available": True,
        "reason": None,
        "baseline_gross_profit": round(base_gp, 2),
        "simulated_gross_profit": round(sim_gp, 2),
        "delta": round(delta, 2),
        "delta_pct": round(delta / abs(base_gp) * 100.0, 2) if abs(base_gp) > 1e-9 else None,
        "unit_cost": round(float(cost_label), 4),
        "cost_source": cost_source,
        "volume_basis": basis,
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
