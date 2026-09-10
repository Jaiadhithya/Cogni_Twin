import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

def generate_complex_dataset(num_rows=5000):
    # Set seed for reproducibility
    np.random.seed(42)
    random.seed(42)

    # 15 Columns configuration
    categories = ['Electronics', 'Apparel', 'Home Goods', 'Accessories']
    products = {
        'Electronics': ['Smart Watch', 'Wireless Earbuds', 'Portable Charger'],
        'Apparel': ['Cotton T-Shirt', 'Denim Jeans', 'Winter Jacket'],
        'Home Goods': ['Ceramic Mug', 'Scented Candle', 'Throw Pillow'],
        'Accessories': ['Leather Wallet', 'Sunglasses', 'Canvas Tote']
    }
    customer_types = ['New', 'Returning', 'VIP']
    locations = ['New York', 'Los Angeles', 'Chicago', 'Online']
    weathers = ['Sunny', 'Rainy', 'Cloudy', 'Snowy']

    # Generate dates (past 3 years approx)
    start_date = datetime(2023, 1, 1)
    
    data = []
    
    current_date = start_date
    
    # We will generate rows daily. To get 5000 rows across ~900 days, we need about 5-6 transactions per day.
    for i in range(num_rows):
        # Progress date slightly
        if i % 6 == 0:
            current_date += timedelta(days=1)
            
        category = random.choice(categories)
        product_name = random.choice(products[category])
        
        # Base price and variations
        base_price = random.uniform(15.0, 150.0)
        unit_price = round(base_price * random.uniform(0.9, 1.1), 2)
        
        # Units sold (more for cheaper items)
        if unit_price < 30:
            units_sold = random.randint(5, 25)
        else:
            units_sold = random.randint(1, 10)
            
        discount_applied = round(random.choice([0, 0, 0, 0.05, 0.10, 0.15, 0.20]), 2)
        sales_revenue = round((unit_price * units_sold) * (1 - discount_applied), 2)
        
        # Regressors for forecasting
        marketing_spend = round(random.uniform(50.0, 500.0), 2)
        supplier_lead_time_days = random.randint(2, 14)
        competitor_discount_pct = round(random.uniform(0.0, 0.3), 2)
        
        # Other categorical data
        cust_type = random.choice(customer_types)
        location = random.choice(locations)
        weather = random.choice(weathers)
        
        data.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'transaction_id': f"TRX-{10000 + i}",
            'product_id': f"PROD-{hash(product_name) % 10000:04d}",
            'product_name': product_name,
            'category': category,
            'units_sold': units_sold,
            'unit_price': unit_price,
            'sales_revenue': sales_revenue,
            'discount_applied_pct': discount_applied,
            'marketing_spend': marketing_spend,
            'supplier_lead_time_days': supplier_lead_time_days,
            'competitor_discount_pct': competitor_discount_pct,
            'customer_type': cust_type,
            'store_location': location,
            'weather_condition': weather
        })

    df = pd.DataFrame(data)
    
    # Save to CSV
    output_path = "c:/ML Project/complex_dataset.csv"
    df.to_csv(output_path, index=False)
    print(f"Generated complex dataset with {len(df)} rows and {len(df.columns)} columns at {output_path}")

if __name__ == "__main__":
    generate_complex_dataset(5000)
