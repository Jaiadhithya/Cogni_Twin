# Demo datasets

Both files are synthetic and made by `generate_demo_datasets.py` (fixed seeds, so rerunning gives identical files).

| File | Use it for | Rows | Period | Forecast error (14-day backtest) |
|---|---|---|---|---|
| `nexa_electronics_sales_2024_2026.csv` | Main dataset: dashboard, forecast, scenarios, Ask AI | 17,520 | 1 Oct 2024 – 30 Sep 2026 | ~3% |
| `brewhaus_cafe_sales_2025_2026.csv` | Live upload during the demo (a different business, different column names) | 7,312 | 1 Jul 2025 – 30 Sep 2026 | ~3% |

For comparison, the old `retail_enterprise_business_data.csv` scores ~50%, because its daily total depended on which random products happened to sell that day.

## Nexa Electronics (consumer-electronics retailer, India)

`date, product_category, sku_name, region, net_revenue, units_sold, unit_price, discount_pct, competitor_discount_pct, marketing_spend`

- 4 categories × 2 SKUs × 3 regions, every day.
- What drives revenue: ~20% yearly growth, busy weekends, a festive peak in late Oct–early Nov, a summer lift and a January lull.
- Levers the what-if simulator should show:

  | Lever | Effect on revenue |
  |---|---|
  | Discount | up |
  | Marketing spend | up |
  | Competitor discount | down |
  | Unit price | down |

- `units_sold` is automatically left out of the model, because it is a result of sales and not a lever.

## Brewhaus Cafés (café chain, 4 cities)

`order_date, outlet_city, menu_category, net_sales, orders, avg_ticket_inr, promo_discount_pct, ad_spend_inr, rainfall_mm`

- Bengaluru, Mumbai, Chennai and Pune, with Coffee, Tea, Bakery and Meals.
- What drives sales: new-store growth, weekend peaks, more hot drinks in winter and fewer walk-ins in the monsoon.
- Levers:

  | Lever | Effect on sales |
  |---|---|
  | Promo discount | up |
  | Ad spend | up |
  | Average ticket price | down |
  | Rainfall | down |

- `orders` is automatically left out of the model.

## Demo questions that work well

- "Which category had the highest net revenue?" / "Which city sells the most?"
- "How did revenue change in the festive season?"
- In Scenarios: raise the discount by 5 points, or cut marketing by 20%.
