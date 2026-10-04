"""Generate the two demo datasets in this folder.

1. ``nexa_electronics_sales_2024_2026.csv`` - the main forecasting dataset. Two years of
   daily sales for an Indian consumer-electronics retailer. Most of the movement comes from
   things a forecaster can learn (growth, weekday pattern, festive season), and the levers
   (price, discount, competitor discount, marketing) move smoothly, so forecasts are accurate
   and the what-if simulator still has real effects to show.

2. ``brewhaus_cafe_sales_2025_2026.csv`` - a second, different business for the live upload
   demo. A café chain across four cities with different column names, to show the platform
   detects the date, target and levers on its own.

Every day has the same set of rows (fixed product x region grid), so the daily total the
forecaster sees is not distorted by how many transactions happened to be logged that day.

Run:  python demo_data/generate_demo_datasets.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent


def _weekly_steps(rng: np.random.Generator, n_days: int, lo: float, hi: float, step: float, start: float) -> np.ndarray:
    """A value that changes once a week by a small random step, kept within [lo, hi]."""
    weeks = n_days // 7 + 2
    vals = [start]
    for _ in range(weeks - 1):
        vals.append(float(np.clip(vals[-1] + rng.normal(0, step), lo, hi)))
    return np.repeat(vals, 7)[:n_days]


def _festive_bump(dates: pd.DatetimeIndex, peak_doy: int, width_days: float, height: float) -> np.ndarray:
    """Smooth seasonal bump around a day of the year (wraps across the year end)."""
    doy = dates.dayofyear.to_numpy()
    d = np.minimum(np.abs(doy - peak_doy), 365 - np.abs(doy - peak_doy))
    return height * np.exp(-0.5 * (d / width_days) ** 2)


# ---------------------------------------------------------------------------------------------
# 1. Nexa Electronics - main forecasting dataset
# ---------------------------------------------------------------------------------------------

def nexa_electronics(seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-10-01", "2026-09-30", freq="D")
    n = len(dates)
    t_years = np.arange(n) / 365.0

    # Levers, shared by all rows on a day (a campaign or price list applies chain-wide).
    festive = _festive_bump(dates, peak_doy=300, width_days=18, height=1.0)  # late Oct / early Nov
    marketing = 95_000 * (1 + 0.12 * t_years) * (1 + 0.45 * festive) * _weekly_steps(rng, n, 0.85, 1.15, 0.04, 1.0)
    discount = np.clip(_weekly_steps(rng, n, 4.0, 9.0, 0.6, 6.0) + 6.0 * festive, 0, 18)
    competitor = _weekly_steps(rng, n, 4.0, 13.0, 0.8, 8.0)
    # List-price revisions on fixed dates plus flash-sale / price-match weeks. Moving price
    # independently of growth is what lets the platform measure price sensitivity.
    revisions = np.where(dates >= "2025-04-01", 1.03, 1.0) * np.where(dates >= "2026-04-01", 1.04, 1.0)
    price_index = revisions * _weekly_steps(rng, n, 0.93, 1.05, 0.025, 1.0)

    # Chain-wide daily revenue (INR).
    weekday = np.array([0.93, 0.94, 0.97, 1.00, 1.05, 1.13, 1.10])[dates.dayofweek]
    season = (
        1.0
        + 0.24 * festive
        + _festive_bump(dates, peak_doy=135, width_days=25, height=0.06)   # summer (AC, fans)
        - _festive_bump(dates, peak_doy=20, width_days=15, height=0.07)    # January lull
    )
    trend = 1.0 + 0.20 * t_years
    levers = (
        (marketing / 95_000) ** 0.15
        * (1 + 0.018 * (discount - 6.0))
        * (1 - 0.012 * (competitor - 8.0))
        * price_index ** -0.9  # revenue elasticity; units fall ~1.9% per 1% price rise
    )
    noise = rng.lognormal(0.0, 0.03, n)
    total = 2_400_000 * trend * weekday * season * levers * noise

    products = [
        # category, sku, base unit price (INR), revenue share
        ("Smartphones", "Nexa Phone X2", 32_999, 0.20),
        ("Smartphones", "Nexa Phone Lite", 14_999, 0.13),
        ("Laptops", "Nexa Book Pro 14", 74_990, 0.16),
        ("Laptops", "Nexa Book Air 13", 49_990, 0.09),
        ("Audio", "Nexa Buds ANC", 5_499, 0.10),
        ("Audio", "Nexa SoundBar 300", 12_999, 0.06),
        ("Smart Home", "Nexa Cam 360", 3_299, 0.11),
        ("Smart Home", "Nexa Air Purifier", 11_499, 0.15),
    ]
    regions = [("North", 0.36), ("West", 0.34), ("South", 0.30)]

    rows = []
    for i, d in enumerate(dates):
        for cat, sku, base_price, share in products:
            # Smart Home grows faster; laptops slowly lose share to phones.
            drift = {"Smart Home": 1 + 0.10 * t_years[i], "Laptops": 1 - 0.04 * t_years[i]}.get(cat, 1.0)
            for region, r_share in regions:
                rev = total[i] * share * drift * r_share * rng.lognormal(0.0, 0.015)
                price = base_price * price_index[i] * rng.uniform(0.99, 1.01)
                units = max(1, round(rev / (price * (1 - discount[i] / 100))))
                rows.append({
                    "date": d.date().isoformat(),
                    "product_category": cat,
                    "sku_name": sku,
                    "region": region,
                    "net_revenue": round(rev, 2),
                    "units_sold": units,
                    "unit_price": round(price, 2),
                    "discount_pct": round(discount[i], 1),
                    "competitor_discount_pct": round(competitor[i], 1),
                    "marketing_spend": round(marketing[i] * share * r_share, 2),
                })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------------------------
# 2. Brewhaus Cafés - upload demo dataset
# ---------------------------------------------------------------------------------------------

def brewhaus_cafes(seed: int = 21) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2025-07-01", "2026-09-30", freq="D")
    n = len(dates)
    t_years = np.arange(n) / 365.0

    # Monsoon: smooth seasonal rain level (mm/day), Jun-Sep, plus mild day-to-day variation.
    monsoon = _festive_bump(dates, peak_doy=205, width_days=35, height=1.0)
    rainfall = np.clip(14 * monsoon * rng.lognormal(0, 0.25, n) + rng.exponential(0.3, n), 0, None)
    winter = _festive_bump(dates, peak_doy=5, width_days=30, height=1.0)

    ad_spend = 18_000 * (1 + 0.15 * t_years) * _weekly_steps(rng, n, 0.8, 1.2, 0.05, 1.0)
    promo = _weekly_steps(rng, n, 0.0, 15.0, 2.0, 5.0)
    # Menu price revisions on fixed dates plus short-lived offers, independent of the growth trend.
    revisions = np.where(dates >= "2025-11-01", 1.04, 1.0) * np.where(dates >= "2026-04-01", 1.03, 1.0)
    ticket_index = revisions * _weekly_steps(rng, n, 0.94, 1.06, 0.02, 1.0)

    weekday = np.array([0.90, 0.92, 0.95, 0.98, 1.06, 1.15, 1.12])[dates.dayofweek]
    season = 1.0 + 0.10 * winter - 0.09 * monsoon            # hot drinks in winter, fewer walk-ins in monsoon
    trend = 1.0 + 0.30 * t_years                              # new-store ramp-up
    levers = (
        (ad_spend / 18_000) ** 0.12
        * (1 + 0.012 * (promo - 5.0))
        * (1 - 0.004 * (rainfall - rainfall.mean()))
        * ticket_index ** -1.1
    )
    total = 620_000 * trend * weekday * season * levers * rng.lognormal(0.0, 0.035, n)

    cities = [("Bengaluru", 0.34), ("Mumbai", 0.28), ("Chennai", 0.20), ("Pune", 0.18)]
    menu = [("Coffee", 0.42, 240), ("Tea", 0.14, 160), ("Bakery", 0.22, 190), ("Meals", 0.22, 380)]

    rows = []
    for i, d in enumerate(dates):
        for city, c_share in cities:
            for item, m_share, ticket in menu:
                tilt = 1 + (0.15 * winter[i] if item in ("Coffee", "Tea") else 0.0)
                sales = total[i] * c_share * m_share * tilt * rng.lognormal(0.0, 0.02)
                avg_ticket = ticket * ticket_index[i] * rng.uniform(0.98, 1.02)
                rows.append({
                    "order_date": d.date().isoformat(),
                    "outlet_city": city,
                    "menu_category": item,
                    "net_sales": round(sales, 2),
                    "orders": max(1, round(sales / avg_ticket)),
                    "avg_ticket_inr": round(avg_ticket, 2),
                    "promo_discount_pct": round(promo[i], 1),
                    "ad_spend_inr": round(ad_spend[i] * c_share * m_share, 2),
                    "rainfall_mm": round(rainfall[i], 1),
                })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    for name, frame in (
        ("nexa_electronics_sales_2024_2026.csv", nexa_electronics()),
        ("brewhaus_cafe_sales_2025_2026.csv", brewhaus_cafes()),
    ):
        frame.to_csv(OUT / name, index=False)
        print(f"{name}: {len(frame):,} rows, {frame.iloc[:, 0].min()} to {frame.iloc[:, 0].max()}")
