"""Choose which numeric columns may act as forecast regressors (what-if levers).

A regressor must be something the business can set *before* the outcome is known:
price, discount, marketing spend, lead time. Columns that are themselves outcomes of
the same sales (units sold, revenue, profit, COGS) leak the answer into the model and
make nonsense levers ("what if gross profit were 10% higher?"), so they are excluded.

Two guards, each with a recorded reason:

1. **By meaning** — a column whose name marks it as an outcome (volume, revenue, profit,
   cost of goods) is dropped, unless its name also marks it as an input rate or setting
   (``unit_price``, ``discount_pct``, ``marketing_spend``…).
2. **By statistics** — a column that moves almost exactly with the target
   (|Pearson r| ≥ ``NEAR_DUPLICATE_R``) is treated as derived from it and dropped, which
   catches outcome columns with unusual names.
"""

from __future__ import annotations

import math
import re
from typing import Sequence

NEAR_DUPLICATE_R = 0.97
MIN_POINTS_FOR_CORRELATION = 10

_OUTCOME_TOKENS = {
    "revenue", "revenues", "sales", "gmv", "turnover", "income", "earnings",
    "profit", "profits", "margin", "cogs",
    "sold", "qty", "quantity", "quantities", "volume", "orders", "order", "units", "count",
    "amount", "total",
}
# Tokens that mark a column as a rate, price or setting the business controls.
_INPUT_TOKENS = {
    "price", "prices", "rate", "pct", "percent", "percentage", "discount", "spend",
    "budget", "cost", "fee", "days", "time", "lead", "score", "index", "temperature",
}
_SPLIT = re.compile(r"[^a-z0-9]+")


def _tokens(name: str) -> set[str]:
    # Split snake_case, kebab-case and camelCase alike.
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name)
    return {t for t in _SPLIT.split(spaced.lower()) if t}


def is_outcome_name(name: str) -> bool:
    """True when the column name says it is an outcome rather than an input."""
    tokens = _tokens(name)
    if {"cost", "goods"} <= tokens:  # cost_of_goods_sold is COGS, an outcome
        return True
    return bool(tokens & _OUTCOME_TOKENS) and not (tokens & _INPUT_TOKENS)


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> float | None:
    n = len(xs)
    if n < MIN_POINTS_FOR_CORRELATION:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0 or syy <= 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sxx * syy)


def select_regressors(rows: Sequence[dict], candidates: Sequence[str]) -> tuple[list[str], dict[str, str]]:
    """Split ``candidates`` into usable regressors and excluded columns with reasons.

    ``rows`` are the aggregated daily rows (``{"actual": target, <column>: value}``).
    """
    kept: list[str] = []
    excluded: dict[str, str] = {}
    for col in candidates:
        if is_outcome_name(col):
            excluded[col] = "outcome column (a result of sales, not a lever)"
            continue
        pairs = [(r[col], r["actual"]) for r in rows if r.get(col) is not None and r.get("actual") is not None]
        r = _pearson([p[0] for p in pairs], [p[1] for p in pairs])
        if r is not None and abs(r) >= NEAR_DUPLICATE_R:
            excluded[col] = f"moves almost exactly with the target (r = {r:.2f}), so it is derived from it"
            continue
        kept.append(col)
    return kept, excluded
