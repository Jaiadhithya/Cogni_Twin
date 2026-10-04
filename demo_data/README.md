# Demo datasets

Both files are synthetic and made by `generate_demo_datasets.py` (fixed seeds, so rerunning gives identical files).

| File | Use it for | Rows | Period | Forecast error (14-day backtest) |
|---|---|---|---|---|
| `nexa_electronics_sales_2024_2026.csv` | Main dataset: dashboard, forecast, scenarios, Ask AI | 17,520 | 1 Oct 2024 – 30 Sep 2026 | ~3% |
| `brewhaus_cafe_sales_2025_2026.csv` | Live upload during the demo (a different business, different column names) | 7,312 | 1 Jul 2025 – 30 Sep 2026 | ~3% |

For comparison, the older retail sample dataset these replaced scored ~50%, because its daily total depended on which random products happened to sell that day.

## Nexa Electronics (consumer-electronics retailer, India)

`date, product_category, sku_name, region, net_revenue, units_sold, unit_price, discount_pct, competitor_discount_pct, marketing_spend`

- 4 categories × 2 SKUs × 3 regions, every day.
- What drives revenue: ~20% yearly growth, busy weekends, a festive peak in late Oct–early Nov, a summer lift and a January lull.
- Prices: list-price revisions in April 2025 and April 2026, plus flash-sale and price-match weeks.
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

## Profit and price cards

Both files forecast revenue, so the platform estimates units sold as revenue ÷ price. Profit and the optimal price also need a cost, which neither file has. Type one into **Cost per unit** in the what-if panel:

| Dataset | Suggested cost per unit | Why |
|---|---|---|
| Nexa Electronics | ₹12,500 | About 45% of the ~₹27,900 average list price the platform works with (the simple average of `unit_price` across SKUs) |
| Brewhaus Cafés | ₹113 | About 45% of the ~₹255 average ticket |

With these costs the profit-maximising price lands inside the prices each dataset has seen. With a lower cost, such as ₹95 for Brewhaus, it falls below that range, and the card says to treat it as a direction rather than a target.

Price sensitivity needs no cost. It comes out at about −1.9 for Nexa and −1.8 for Brewhaus: a 1% price rise cuts units sold by about 1.9% and 1.8%. Both prices move independently of growth (price revisions and short offers), which is what makes this measurable.

## Demo questions that work well

- "Which category had the highest net revenue?" / "Which city sells the most?"
- "How did revenue change in the festive season?"
- In Scenarios: raise the discount by 5 points, or cut marketing by 20%.
