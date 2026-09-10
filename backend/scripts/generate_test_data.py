import os
import pandas as pd
from datetime import datetime, timedelta
import random

def generate_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.join(base_dir, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Generate bad_sales.csv (missing sale_date)
    bad_data = {
        "product_name": ["Widget A", "Widget B", "Widget C"],
        "quantity": [10, 5, 20],
        "unit_price": [15.0, 20.0, 10.0],
        "total_amount": [150.0, 100.0, 200.0]
    }
    df_bad = pd.DataFrame(bad_data)
    df_bad.to_csv(os.path.join(uploads_dir, "bad_sales.csv"), index=False)
    
    # Generate good_sales.csv (365 rows)
    start_date = datetime(2023, 1, 1)
    dates = [start_date + timedelta(days=i) for i in range(365)]
    
    products = ["Widget A", "Widget B", "Widget C", "Widget D"]
    categories = ["Electronics", "Hardware", "Accessories"]
    
    good_data = {
        "sale_date": [d.strftime("%Y-%m-%d") for d in dates],
        "product_name": [random.choice(products) for _ in range(365)],
        "category": [random.choice(categories) for _ in range(365)],
        "quantity": [random.randint(1, 100) for _ in range(365)],
        "unit_price": [round(random.uniform(10.0, 50.0), 2) for _ in range(365)]
    }
    
    # Calculate total amount to ensure no negative revenue
    good_data["total_amount"] = [
        round(q * p, 2) for q, p in zip(good_data["quantity"], good_data["unit_price"])
    ]
    
    df_good = pd.DataFrame(good_data)
    df_good.to_csv(os.path.join(uploads_dir, "good_sales.csv"), index=False)
    print("Test data generated successfully in backend/uploads/")

if __name__ == "__main__":
    generate_data()
