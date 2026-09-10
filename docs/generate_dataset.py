import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import uuid

# Set random seed for reproducibility
np.random.seed(42)

num_rows = 1000

# 1. Dates (Daily over roughly 3 years)
start_date = datetime(2021, 1, 1)
dates = [start_date + timedelta(days=i) for i in range(num_rows)]

# 2. Transaction IDs
tx_ids = [str(uuid.uuid4())[:8] for _ in range(num_rows)]

# 3. Categories
categories = np.random.choice(['Electronics', 'Apparel', 'Home Goods', 'Beauty', 'Sports'], size=num_rows, p=[0.3, 0.25, 0.2, 0.15, 0.1])

# 4. Regions
regions = np.random.choice(['North', 'South', 'East', 'West', 'Central'], size=num_rows)

# 5. Customer Types
customer_types = np.random.choice(['Retail', 'Wholesale', 'Corporate'], size=num_rows, p=[0.6, 0.3, 0.1])

# 6. Units Sold
units_sold = np.random.randint(10, 500, size=num_rows)

# 7. Unit Price
# Create base prices depending on category
base_prices = {
    'Electronics': 299.99,
    'Apparel': 49.99,
    'Home Goods': 149.99,
    'Beauty': 29.99,
    'Sports': 89.99
}
unit_prices = [base_prices[cat] * np.random.uniform(0.8, 1.2) for cat in categories]
unit_prices = np.round(unit_prices, 2)

# 8. Marketing Spend (Adds some random noise and seasonal spikes)
marketing_spend = np.random.uniform(500, 5000, size=num_rows)
# Add some spikes for weekends/holidays roughly
for i in range(num_rows):
    if i % 30 == 0:  # Fake monthly spike
        marketing_spend[i] += np.random.uniform(2000, 5000)
marketing_spend = np.round(marketing_spend, 2)

# 9. Discount Rate
discount_rates = np.random.choice([0.0, 0.05, 0.10, 0.15, 0.20], size=num_rows, p=[0.5, 0.2, 0.15, 0.1, 0.05])

# 10. Total Revenue (Units * Price * (1 - Discount))
total_revenue = units_sold * unit_prices * (1 - discount_rates)

# Inject some realistic trends into revenue over time (e.g., slight growth)
growth_factor = np.linspace(1.0, 1.5, num=num_rows)
total_revenue = total_revenue * growth_factor
total_revenue = np.round(total_revenue, 2)

# Create DataFrame
df = pd.DataFrame({
    'transaction_date': [d.strftime('%Y-%m-%d') for d in dates],
    'transaction_id': tx_ids,
    'category': categories,
    'region': regions,
    'customer_type': customer_types,
    'units_sold': units_sold,
    'unit_price': unit_prices,
    'marketing_spend': marketing_spend,
    'discount_rate': discount_rates,
    'total_revenue': total_revenue
})

# Save to CSV
output_path = r'c:\ML Project\docs\sample_dataset_1000.csv'
df.to_csv(output_path, index=False)
print(f"Dataset successfully generated at {output_path}")
