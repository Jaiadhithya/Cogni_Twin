import os
import pandas as pd
from sqlalchemy import create_engine

def seed_db():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, 'uploads', 'multivariate_sales.csv')
    db_path = os.path.join(base_dir, 'cognitwin.db')
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} does not exist.")
        return
        
    engine = create_engine(f'sqlite:///{db_path}')
    df = pd.read_csv(csv_path)
    
    # Rename 'ds' to 'date' for the sales table schema
    df = df.rename(columns={'ds': 'date'})
    
    print(f"Seeding {len(df)} rows into {db_path}...")
    df.to_sql('sales', con=engine, if_exists='replace', index=False)
    print("Database seed complete.")

if __name__ == "__main__":
    seed_db()
