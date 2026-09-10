import pandas as pd
import numpy as np
import time
import uuid
import sys
import os
from typing import List, Dict, Any

from src.infrastructure.ingestion.csv_parser import CSVParser
from src.infrastructure.ingestion.schema_mapper import SchemaMapper
from src.infrastructure.ingestion.data_cleaner import DataCleaner
from src.infrastructure.ingestion.row_validator import RowValidator

def run_benchmark():
    num_rows = 50000
    print(f"Generating synthetic dataset with {num_rows} rows...")
    
    # Generate CSV
    df = pd.DataFrame({
        'date': ['2024-01-01', '2024-01-02', 'invalid', '2024-01-04', '2024-01-05'] * (num_rows // 5),
        'product name': ['Product A', 'Product B', 'Product C', 'Product A', 'Product D'] * (num_rows // 5),
        'qty': [5, -2, 1, 10, 'invalid'] * (num_rows // 5),
        'price': ['.00', '15.0', '5.0', '10.0', '20.5%'] * (num_rows // 5),
        'total': ['50.0', '30.0', '5.0', '100.0', ''] * (num_rows // 5),
        'customer': ['John', '=cmd', 'Jane', 'Doe', 'Smith'] * (num_rows // 5)
    })
    
    file_path = "benchmark_sales.csv"
    df.to_csv(file_path, index=False)
    print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
    
    # 1. Parsing
    t0 = time.time()
    parsed_df, warnings = CSVParser.parse(file_path)
    t1 = time.time()
    print(f"Parsing time: {t1 - t0:.4f}s")
    
    # 2. Mapping
    t2 = time.time()
    mapper = SchemaMapper()
    mapping, map_warnings = mapper.map_columns("sales", list(parsed_df.columns))
    t3 = time.time()
    print(f"Mapping time: {t3 - t2:.4f}s")
    
    # 3. Cleaning
    t4 = time.time()
    clean_df, clean_warnings, skipped = DataCleaner.clean(parsed_df, "sales", mapping)
    t5 = time.time()
    print(f"Cleaning time: {t5 - t4:.4f}s")
    
    # 4. Validation
    t6 = time.time()
    valid_dicts, val_warnings, errors = RowValidator.validate(clean_df, "sales")
    t7 = time.time()
    print(f"Validation time: {t7 - t6:.4f}s")
    
    os.remove(file_path)

if __name__ == '__main__':
    run_benchmark()
