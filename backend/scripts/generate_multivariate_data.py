"""Synthetic Multi-Variate Business Data Generator for Cognitia Twin Phase 6.

Generates a 2-year daily dataset with embedded correlations:
- Target: sales_volume (y)
- Levers: unit_price, marketing_spend, supplier_lead_time_days, competitor_discount_pct

Correlation Model:
  Base Volume ~ 120 + Trend(+0.15/day) + Weekly Seasonality + Yearly Seasonality
  price_effect      = -2.5 * (unit_price - mean_price)
  marketing_effect  = +0.08 * marketing_spend  
  leadtime_effect   = -8.0 * max(0, supplier_lead_time - 5)
  competitor_effect  = -1.2 * competitor_discount_pct
  sales_volume = max(0, base + effects + noise)
  revenue = sales_volume * unit_price
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_multivariate_data(
    start_date: str = "2024-07-01",
    days: int = 730,
    seed: int = 42,
    output_dir: str = None
) -> pd.DataFrame:
    """Generate synthetic multi-variate sales dataset."""
    np.random.seed(seed)
    
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    os.makedirs(output_dir, exist_ok=True)
    
    dates = pd.date_range(start=start_date, periods=days, freq='D')
    day_index = np.arange(days)
    
    # === UNIT PRICE ===
    # Sinusoidal variation around ₹250 ± ₹80 with quarterly promotional dips
    mean_price = 250.0
    price_base = mean_price + 40 * np.sin(2 * np.pi * day_index / 90)  # quarterly cycle
    # Promotional dips: Diwali (Oct-Nov), Pongal (Jan), Independence Day (Aug)
    price_promos = np.zeros(days)
    for i, d in enumerate(dates):
        if (d.month == 10 and d.day >= 20) or (d.month == 11 and d.day <= 10):  # Diwali
            price_promos[i] = -60
        elif d.month == 1 and d.day <= 20:  # Pongal/New Year
            price_promos[i] = -40
        elif d.month == 8 and 10 <= d.day <= 20:  # Independence Day sales
            price_promos[i] = -30
    unit_price = np.clip(price_base + price_promos + np.random.normal(0, 5, days), 150, 400)
    
    # === MARKETING SPEND ===
    # Baseline ₹15,000/day with festival spikes and seasonal variation
    marketing_base = 15000 + 3000 * np.sin(2 * np.pi * day_index / 365)  # yearly cycle
    marketing_spikes = np.zeros(days)
    for i, d in enumerate(dates):
        if (d.month == 10 and d.day >= 15) or (d.month == 11 and d.day <= 15):  # Diwali season
            marketing_spikes[i] = np.random.uniform(25000, 45000)
        elif d.month == 1 and d.day <= 26:  # Republic Day / Pongal
            marketing_spikes[i] = np.random.uniform(15000, 25000)
        elif d.month == 8 and d.day <= 15:  # Independence Day
            marketing_spikes[i] = np.random.uniform(10000, 20000)
        elif d.month == 12 and d.day >= 20:  # Year-end
            marketing_spikes[i] = np.random.uniform(10000, 18000)
    marketing_spend = np.clip(
        marketing_base + marketing_spikes + np.random.normal(0, 2000, days),
        5000, 70000
    )
    
    # === SUPPLIER LEAD TIME ===
    # Normal ~N(4, 1.5) with disruption events (monsoon Jul-Sep, port strikes)
    leadtime_base = np.random.normal(4, 1.5, days)
    leadtime_disruptions = np.zeros(days)
    for i, d in enumerate(dates):
        # Monsoon disruptions (July-September) - random spikes
        if d.month in [7, 8, 9] and np.random.random() < 0.15:
            leadtime_disruptions[i] = np.random.uniform(5, 12)
        # Random port strikes (~3% chance on any day)
        elif np.random.random() < 0.03:
            leadtime_disruptions[i] = np.random.uniform(4, 8)
    supplier_lead_time = np.clip(leadtime_base + leadtime_disruptions, 1, 20).astype(float)
    
    # === COMPETITOR DISCOUNT ===
    # Stepped pattern with seasonal sale events (0-25%)
    competitor_base = np.random.uniform(2, 8, days)  # normal competitive discounting
    competitor_events = np.zeros(days)
    for i, d in enumerate(dates):
        # Major competitor sales
        if d.month in [1, 7] and d.day <= 15:  # Jan/Jul clearance
            competitor_events[i] = np.random.uniform(10, 20)
        elif d.month == 11 and d.day >= 20:  # Black Friday / pre-Xmas
            competitor_events[i] = np.random.uniform(8, 18)
        elif d.month == 3 and 20 <= d.day <= 31:  # End of financial year
            competitor_events[i] = np.random.uniform(5, 12)
    competitor_discount = np.clip(competitor_base + competitor_events, 0, 25)
    
    # === BASE VOLUME ===
    trend = 0.15 * day_index  # Long-term growth
    weekly_season = 15 * np.sin(2 * np.pi * day_index / 7)  # Day-of-week effect
    yearly_season = 30 * np.sin(2 * np.pi * (day_index - 30) / 365)  # Annual seasonality
    base_volume = 120 + trend + weekly_season + yearly_season
    
    # === EXOGENOUS EFFECTS ===
    price_effect = -2.5 * (unit_price - mean_price)
    marketing_effect = 0.08 * marketing_spend / 100  # Scale marketing to daily effect
    leadtime_effect = -8.0 * np.maximum(0, supplier_lead_time - 5)
    competitor_effect = -1.2 * competitor_discount
    
    # === NOISE ===
    noise = np.random.normal(0, 15, days)
    
    # === FINAL SALES VOLUME ===
    sales_volume = np.maximum(
        0,
        base_volume + price_effect + marketing_effect + leadtime_effect + competitor_effect + noise
    ).astype(int)
    
    # === REVENUE ===
    revenue = (sales_volume * unit_price).round(2)
    
    # === BUILD DATAFRAME ===
    df = pd.DataFrame({
        'ds': dates.strftime('%Y-%m-%d'),
        'sales_volume': sales_volume,
        'unit_price': unit_price.round(2),
        'marketing_spend': marketing_spend.round(2),
        'supplier_lead_time_days': supplier_lead_time.round(1),
        'competitor_discount_pct': competitor_discount.round(2),
        'revenue': revenue
    })
    
    # Save to CSV
    output_path = os.path.join(output_dir, 'multivariate_sales.csv')
    df.to_csv(output_path, index=False)
    
    # Print correlation matrix for verification
    print(f"\n{'='*60}")
    print(f"Generated {len(df)} rows -> {output_path}")
    print(f"{'='*60}")
    print(f"\nDate range: {df['ds'].iloc[0]} to {df['ds'].iloc[-1]}")
    print(f"\nColumn summary:")
    print(df.describe().round(2).to_string())
    print(f"\nCorrelation with sales_volume:")
    numeric_cols = ['sales_volume', 'unit_price', 'marketing_spend', 
                    'supplier_lead_time_days', 'competitor_discount_pct', 'revenue']
    corr = df[numeric_cols].corr()['sales_volume'].drop('sales_volume')
    for col, val in corr.items():
        direction = '+' if val > 0 else '-'
        print(f"  {col:>30s}: {val:+.4f} {direction}")
    
    return df


if __name__ == "__main__":
    generate_multivariate_data()
