"""Outcome columns must never become forecast regressors (what-if levers)."""

import pytest

from src.services.regressor_selection import is_outcome_name, select_regressors


@pytest.mark.parametrize("name", [
    "units_sold", "quantity", "qty", "sales_volume", "order_count", "orders",
    "revenue", "net_revenue", "gross_profit", "profit_margin", "cogs",
    "cost_of_goods_sold", "total_amount", "GrossProfit", "unitsSold",
])
def test_outcome_names_are_excluded(name):
    assert is_outcome_name(name)


@pytest.mark.parametrize("name", [
    "unit_price", "unit_cost", "discount_pct", "competitor_discount_pct", "marketing_spend",
    "supplier_lead_time_days", "customer_satisfaction_score", "sales_tax_rate", "temperature",
])
def test_input_names_are_kept(name):
    assert not is_outcome_name(name)


def _rows(n=40):
    rows = []
    for i in range(n):
        price = 100 + (i % 7) * 5
        marketing = 1000 + (i % 5) * 120
        revenue = 5000 - price * 10 + marketing * 0.8 + (i % 3) * 40
        rows.append({
            "actual": revenue,
            "unit_price": price,
            "marketing_spend": marketing,
            "gross_profit": revenue * 0.5,           # outcome by name
            "weird_metric_x": revenue * 1.0001 + 3,  # derived, unusual name
        })
    return rows


def test_select_keeps_levers_and_reports_reasons():
    kept, excluded = select_regressors(_rows(), ["unit_price", "marketing_spend", "gross_profit", "weird_metric_x"])
    assert kept == ["unit_price", "marketing_spend"]
    assert "outcome" in excluded["gross_profit"]
    assert "moves almost exactly with the target" in excluded["weird_metric_x"]


def test_correlation_guard_needs_enough_points():
    kept, excluded = select_regressors(_rows(5), ["weird_metric_x"])
    assert kept == ["weird_metric_x"] and excluded == {}
