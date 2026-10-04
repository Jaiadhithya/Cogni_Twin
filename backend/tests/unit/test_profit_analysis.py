"""Profit and price-elasticity maths, checked against synthetic data of known elasticity."""

import numpy as np
import pytest

import pandas as pd

from src.services.profit_analysis import (
    VOLUME_IMPLIED,
    estimate_price_elasticity,
    gross_profit,
    identify_columns,
    implied_volume,
    profit_maximising_price,
    profit_report,
    volume_basis,
)


def _demand(elasticity: float, n: int = 120, seed: int = 0, noise: float = 0.03):
    rng = np.random.default_rng(seed)
    price = rng.uniform(5.0, 15.0, n)
    volume = 5000.0 * price ** elasticity * np.exp(rng.normal(0, noise, n))
    return price, volume


@pytest.mark.parametrize("true_e", [-2.0, -1.5, -0.6])
def test_recovers_known_elasticity(true_e):
    price, volume = _demand(true_e)
    fit = estimate_price_elasticity(price, volume)
    assert fit["usable"], fit
    assert fit["elasticity"] == pytest.approx(true_e, abs=0.1)
    assert fit["r2"] > 0.9 and fit["n"] == 120


def test_controls_remove_confounding_from_marketing():
    rng = np.random.default_rng(1)
    n = 200
    marketing = rng.uniform(0, 1, n)
    price = 10 + 3 * marketing + rng.normal(0, 0.5, n)  # price is higher when marketing is high
    volume = 800 * price ** -1.8 * np.exp(1.2 * marketing + rng.normal(0, 0.02, n))
    naive = estimate_price_elasticity(price, volume)["elasticity"]
    controlled = estimate_price_elasticity(price, volume, {"marketing_spend": marketing})
    assert controlled["controls"] == ["marketing_spend"]
    assert abs(controlled["elasticity"] - (-1.8)) < abs(naive - (-1.8))
    assert controlled["elasticity"] == pytest.approx(-1.8, abs=0.15)


def test_too_few_points_is_unusable_with_reason():
    price, volume = _demand(-2.0, n=10)
    fit = estimate_price_elasticity(price, volume)
    assert not fit["usable"] and fit["elasticity"] is None and "at least" in fit["reason"]


def test_constant_price_is_unusable():
    fit = estimate_price_elasticity([10.0] * 50, np.linspace(100, 120, 50))
    assert not fit["usable"] and "barely varies" in fit["reason"]


def test_noise_only_is_not_usable():
    rng = np.random.default_rng(3)
    fit = estimate_price_elasticity(rng.uniform(5, 15, 100), rng.uniform(80, 120, 100))
    assert not fit["usable"]


def test_optimal_price_formula_and_sign_convention():
    price, volume = _demand(-2.0)
    fit = estimate_price_elasticity(price, volume)
    out = profit_maximising_price(fit, unit_cost=4.0, observed_price_range=(5.0, 15.0))
    # e / (e + 1) * cost = -2 / -1 * 4 = 8
    assert out["price"] == pytest.approx(8.0, rel=0.08)
    assert out["extrapolated"] is False

    far = profit_maximising_price(fit, unit_cost=40.0, observed_price_range=(5.0, 15.0))
    assert far["extrapolated"] is True


def test_optimal_price_is_actually_profit_maximising():
    e, cost = -2.5, 6.0
    p_star = e / (e + 1) * cost
    profit = lambda p: (p - cost) * p ** e
    assert profit(p_star) > profit(p_star * 0.9) and profit(p_star) > profit(p_star * 1.1)


def test_inelastic_demand_has_no_optimum():
    price, volume = _demand(-0.6)
    out = profit_maximising_price(estimate_price_elasticity(price, volume), unit_cost=4.0)
    assert out["price"] is None and "inelastic" in out["reason"]


def test_no_cost_or_poor_fit_returns_null_with_reason():
    price, volume = _demand(-2.0)
    fit = estimate_price_elasticity(price, volume)
    assert profit_maximising_price(fit, unit_cost=None)["price"] is None
    assert "cost" in profit_maximising_price(fit, unit_cost=None)["reason"]
    bad = {"usable": False, "elasticity": -2.0, "reason": "Poor fit"}
    assert profit_maximising_price(bad, unit_cost=4.0) == {"price": None, "reason": "Poor fit"}


def test_gross_profit_formula():
    assert gross_profit([10, 20], [5, 5], [2, 2], [10, 10]) == pytest.approx(10 * 3 + 20 * 3 - 20)


def test_identify_columns():
    cols = identify_columns(["unit_price", "unit_cost", "marketing_spend", "supplier_lead_time_days"], "units_sold")
    assert cols == {
        "price": "unit_price",
        "cost": "unit_cost",
        "marketing": "marketing_spend",
        "target_is_units": True,
        "target_is_revenue": False,
    }
    revenue = identify_columns(["price", "cogs"], "revenue")
    assert revenue["target_is_units"] is False and revenue["target_is_revenue"] is True
    no_cost = identify_columns(["unit_price", "marketing_spend"], "units_sold")
    assert no_cost["cost"] is None and no_cost["price"] == "unit_price"


def _paths(price_mult=1.0, marketing_mult=1.0, h=3):
    return {"unit_price": [10.0 * price_mult] * h, "marketing_spend": [5.0 * marketing_mult] * h, "unit_cost": [4.0] * h}


COLS = {"price": "unit_price", "cost": "unit_cost", "marketing": "marketing_spend", "target_is_units": True}


def test_profit_report_values_and_margin_guardrail():
    # volume up 20% but price cut 30% -> profit falls
    report = profit_report([100, 100, 100], [120, 120, 120], _paths(), _paths(price_mult=0.7), COLS)
    assert report["available"] and report["cost_source"] == "dataset_column:unit_cost"
    assert report["baseline_gross_profit"] == pytest.approx(3 * (100 * 6 - 5))
    assert report["simulated_gross_profit"] == pytest.approx(3 * (120 * 3 - 5))
    assert report["delta"] < 0 and report["margin_guardrail"]["triggered"] is True

    ok = profit_report([100] * 3, [120] * 3, _paths(), _paths(marketing_mult=1.1), COLS)
    assert ok["delta"] > 0 and ok["margin_guardrail"]["triggered"] is False


def test_profit_report_request_cost_overrides_and_missing_cost_is_null():
    paths = {k: v for k, v in _paths().items() if k != "unit_cost"}
    no_cost_cols = {**COLS, "cost": None}
    missing = profit_report([100] * 3, [110] * 3, paths, paths, no_cost_cols)
    assert missing["available"] is False and missing["profit"] is None and "cost" in missing["reason"]

    given = profit_report([100] * 3, [110] * 3, paths, paths, no_cost_cols, request_unit_cost=4.0)
    assert given["available"] and given["cost_source"] == "request_unit_cost" and given["unit_cost"] == 4.0


def test_cafe_columns_ticket_is_the_price_and_promo_pct_is_not_marketing():
    cols = identify_columns(["avg_ticket_inr", "promo_discount_pct", "ad_spend_inr", "rainfall_mm"], "net_sales")
    assert cols["price"] == "avg_ticket_inr" and cols["marketing"] == "ad_spend_inr"
    assert cols["target_is_revenue"] and volume_basis(cols) == VOLUME_IMPLIED


def test_profit_report_refuses_a_target_that_is_neither_units_nor_revenue():
    cols = {**COLS, "target_is_units": False, "target_is_revenue": False}
    report = profit_report([100] * 3, [110] * 3, _paths(), _paths(), cols)
    assert report["available"] is False and "neither a unit count nor revenue" in report["reason"]


def test_revenue_target_profit_uses_units_implied_by_price():
    # Revenue 1000/day at price 10 -> 100 units; cost 4/unit; marketing 5/row-average x 2 rows/day.
    cols = {**COLS, "target_is_units": False, "target_is_revenue": True}
    units = implied_volume([1000.0] * 3, [10.0] * 3)
    assert units == [100.0] * 3
    report = profit_report(units, units, _paths(), _paths(), cols, request_unit_cost=4.0, marketing_scale=2.0)
    assert report["available"] and report["volume_basis"] == VOLUME_IMPLIED
    assert report["baseline_gross_profit"] == pytest.approx(3 * (1000 - 100 * 4 - 5 * 2))
    assert any("revenue / price" in a for a in report["assumptions"])


def test_missing_cost_asks_for_a_cost_per_unit():
    paths = {k: v for k, v in _paths().items() if k != "unit_cost"}
    report = profit_report([100] * 3, [110] * 3, paths, paths, {**COLS, "cost": None})
    assert report["reason"].startswith("Enter a cost per unit")


def test_calendar_controls_stop_growth_reading_as_higher_price_more_sales():
    # Prices rise with the business, and units grow even faster, but the true elasticity is -1.5.
    rng = np.random.default_rng(4)
    dates = pd.date_range("2025-01-01", periods=500, freq="D")
    t = np.arange(500) / 365
    price = 100 * (1 + 0.08 * t) * np.exp(rng.normal(0, 0.04, 500))
    units = 1000 * (1 + 0.6 * t) * price ** -1.5 * np.exp(rng.normal(0, 0.02, 500))

    naive = estimate_price_elasticity(price, units)
    assert naive["elasticity"] > -1.0  # confounded: growth hides most of the price effect

    fit = estimate_price_elasticity(price, units, dates=[d.date().isoformat() for d in dates])
    assert fit["usable"] and fit["elasticity"] == pytest.approx(-1.5, abs=0.15)
    assert "trend" in fit["controls"] and "weekday_1" in fit["controls"] and "year_sin_1" in fit["controls"]
