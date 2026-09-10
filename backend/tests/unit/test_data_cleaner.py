"""Unit tests for Data Cleaner."""

import pandas as pd
import numpy as np
from src.infrastructure.ingestion.data_cleaner import DataCleaner

def test_whitespace_normalization():
    df = pd.DataFrame({"name": [" John Doe ", "Jane   Smith", ""]})
    clean_df = DataCleaner._normalize_whitespace(df)
    assert clean_df.iloc[0]["name"] == "John Doe"
    assert clean_df.iloc[1]["name"] == "Jane Smith"
    assert pd.isna(clean_df.iloc[2]["name"])

def test_numeric_cleaning():
    val1 = DataCleaner._clean_numeric("$1,499.00")
    assert val1 == 1499.0
    val2 = DataCleaner._clean_numeric("₹ 1,49,900")
    assert val2 == 149900.0
    val3 = DataCleaner._clean_numeric("invalid")
    assert pd.isna(val3)
    val4 = DataCleaner._clean_numeric("15.5%")
    assert val4 == 0.155

def test_csv_injection_sanitization():
    df = pd.DataFrame({"name": ["=cmd|' /C calc'!A0", "+123", "-test", "@something", " normal"]})
    clean_df = DataCleaner._normalize_whitespace(df)
    assert clean_df.iloc[0]["name"] == "cmd|' /C calc'!A0"
    assert clean_df.iloc[1]["name"] == "123"
    assert clean_df.iloc[2]["name"] == "test"
    assert clean_df.iloc[3]["name"] == "something"
    assert clean_df.iloc[4]["name"] == "normal"

def test_date_parsing():
    df = pd.DataFrame({"sale_date": ["15/12/2024", "16/12/2024", "invalid"]})
    warnings = []
    parsed = DataCleaner._parse_dates(df["sale_date"], warnings, "sale_date")
    assert parsed.iloc[0].year == 2024
    assert parsed.iloc[0].month == 12
    assert parsed.iloc[0].day == 15
    assert pd.isna(parsed.iloc[2])
    assert len(warnings) == 1

def test_clean_sales_data():
    df = pd.DataFrame({
        "sale_date": ["2024-01-01", "2024-01-02", "2024-01-03", None],
        "quantity": ["-5", "10", None, "5"],
        "unit_price": ["$10.00", "20.0", "15.0", "10.0"],
        "total_amount": [None, None, "45.0", "50.0"]
    })
    
    mapping = {k: k for k in df.columns}
    clean_df, warnings, skipped = DataCleaner.clean(df, "sales", mapping)
    
    # 4th row dropped because of missing sale_date
    assert len(clean_df) == 3
    assert skipped == 1
    
    # Negative quantity absolute
    assert clean_df.iloc[0]["quantity"] == 5
    
    # Missing total_amount derived
    assert clean_df.iloc[0]["total_amount"] == 50.0 # 5 * 10
    assert clean_df.iloc[1]["total_amount"] == 200.0 # 10 * 20
    
    # Missing quantity derived
    assert clean_df.iloc[2]["quantity"] == 3 # 45 / 15
