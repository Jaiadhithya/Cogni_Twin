"""Unit tests for hardened ingestion pipeline, data cleaner, and repository schema resolution."""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from src.infrastructure.ingestion.data_cleaner import DataCleaner
from src.services.ingestion import DynamicIngestionService


def test_clean_numeric_financial_currencies_and_accounting():
    """Verify that financial currencies, commas, accounting parens, and percentages are parsed correctly."""
    # Financial currencies
    assert DataCleaner._clean_numeric("$1,499.50") == 1499.50
    assert DataCleaner._clean_numeric("₹ 1,49,900") == 149900.0
    assert DataCleaner._clean_numeric("€ 350.25") == 350.25
    assert DataCleaner._clean_numeric("£99.99") == 99.99
    assert DataCleaner._clean_numeric("¥ 5,000") == 5000.0
    assert DataCleaner._clean_numeric("USD 120.00") == 120.00
    assert DataCleaner._clean_numeric("Rs. 450") == 450.0

    # Accounting parentheses for negative values
    assert DataCleaner._clean_numeric("(1,234.56)") == -1234.56
    assert DataCleaner._clean_numeric("($500.00)") == -500.00
    assert DataCleaner._clean_numeric("(250)") == -250.0

    # Percentages
    assert DataCleaner._clean_numeric("15.5%") == 0.155
    assert DataCleaner._clean_numeric("-5.0%") == -0.05
    assert DataCleaner._clean_numeric("+10%") == 0.10


def test_clean_numeric_signed_and_scientific():
    """Verify that signed numbers and scientific notation are strictly preserved."""
    assert DataCleaner._clean_numeric("+123.45") == 123.45
    assert DataCleaner._clean_numeric("-123.45") == -123.45
    assert DataCleaner._clean_numeric("-$1,234.50") == -1234.50
    assert DataCleaner._clean_numeric("+$1,234.50") == 1234.50
    assert DataCleaner._clean_numeric("1.25e+3") == 1250.0
    assert DataCleaner._clean_numeric("1.5e-3") == 0.0015
    assert DataCleaner._clean_numeric("-2.5E-2") == -0.025
    assert DataCleaner._clean_numeric("+4.2E+2") == 420.0


def test_clean_numeric_null_and_outlier_handling():
    """Verify that null strings, NaN, inf, and extreme outliers are handled properly."""
    assert pd.isna(DataCleaner._clean_numeric("nan"))
    assert pd.isna(DataCleaner._clean_numeric("None"))
    assert pd.isna(DataCleaner._clean_numeric("null"))
    assert pd.isna(DataCleaner._clean_numeric("N/A"))
    assert pd.isna(DataCleaner._clean_numeric("<NA>"))
    assert pd.isna(DataCleaner._clean_numeric("-"))
    assert pd.isna(DataCleaner._clean_numeric("#"))
    assert pd.isna(DataCleaner._clean_numeric(np.nan))
    assert pd.isna(DataCleaner._clean_numeric(None))
    assert pd.isna(DataCleaner._clean_numeric("invalid_string"))
    # Extreme outlier (greater than 1e20)
    assert pd.isna(DataCleaner._clean_numeric("1e25"))


def test_cell_sanitization_preserves_signed_numbers():
    """Verify that spreadsheet formulas are sanitized without corrupting negative numbers or currencies."""
    assert DataCleaner._sanitize_cell("=CMD|'calc'!A0") == "CMD|'calc'!A0"
    assert DataCleaner._sanitize_cell("@SUM(A1:A10)") == "SUM(A1:A10)"
    assert DataCleaner._sanitize_cell("-malicious_macro") == "malicious_macro"
    # Valid signed numbers and currencies MUST NOT have their negative signs stripped
    assert DataCleaner._sanitize_cell("-123.45") == "-123.45"
    assert DataCleaner._sanitize_cell("-1,234.56") == "-1,234.56"
    assert DataCleaner._sanitize_cell("-$500.00") == "-$500.00"
    assert DataCleaner._sanitize_cell("-1.5e-3") == "-1.5e-3"
    assert DataCleaner._sanitize_cell("(100)") == "(100)"


def test_date_parsing_non_standard_formats():
    """Verify parsing slashes, dots, dashes, epoch timestamps, and ISO with timezone offsets."""
    warnings = []
    
    # 1. Non-standard slashes
    s_slash = pd.Series(["15/12/2024", "16/12/2024", "17/12/2024"])
    parsed_slash = DataCleaner._parse_dates(s_slash, warnings, "date_col")
    assert parsed_slash.iloc[0].year == 2024
    assert parsed_slash.iloc[0].month == 12
    assert parsed_slash.iloc[0].day == 15

    # 2. Non-standard dots
    s_dots = pd.Series(["2024.06.10", "2024.06.11", "2024.06.12"])
    parsed_dots = DataCleaner._parse_dates(s_dots, warnings, "date_col")
    assert parsed_dots.iloc[0].year == 2024
    assert parsed_dots.iloc[0].month == 6
    assert parsed_dots.iloc[0].day == 10

    # 3. ISO with timezone offsets
    s_iso_tz = pd.Series(["2024-01-01T14:30:00+02:00", "2024-01-02T14:30:00-05:00"])
    parsed_iso = DataCleaner._parse_dates(s_iso_tz, warnings, "timestamp")
    # Must be normalized to naive UTC datetime
    assert parsed_iso.dt.tz is None
    assert parsed_iso.iloc[0].year == 2024

    # 4. Epoch timestamps (seconds)
    # 1704067200 is 2024-01-01 00:00:00 UTC
    s_epoch_sec = pd.Series([1704067200, 1704153600, 1704240000])
    parsed_epoch = DataCleaner._parse_dates(s_epoch_sec, warnings, "timestamp")
    assert parsed_epoch.iloc[0].year == 2024
    assert parsed_epoch.iloc[0].month == 1
    assert parsed_epoch.iloc[0].day == 1

    # 5. Epoch timestamps (milliseconds)
    s_epoch_ms = pd.Series([1704067200000, 1704153600000, 1704240000000])
    parsed_epoch_ms = DataCleaner._parse_dates(s_epoch_ms, warnings, "epoch_time")
    assert parsed_epoch_ms.iloc[0].year == 2024
    assert parsed_epoch_ms.iloc[0].month == 1
    assert parsed_epoch_ms.iloc[0].day == 1


def test_clean_dynamic_df_preserves_data_and_strips_artifacts():
    """Verify that clean_dynamic_df cleans dirty data and eliminates synthetic/artifact columns."""
    raw_df = pd.DataFrame({
        "Unnamed: 0": [0, 1, 2],  # Index artifact to prune
        "transaction_date": ["15/01/2024", "16/01/2024", "17/01/2024"],
        "region": [" North America ", "EMEA", "APAC"],
        "sales_channel": ["Direct", "E-Commerce", "Partner"],
        "price_string": ["$1,200.50", "€850.00", "(300.00)"],
        "scientific_val": ["1.2e-3", "-4.5e-2", "+1.0e2"],
        "empty_column": [None, None, None]
    })

    cleaned_df, warnings = DataCleaner.clean_dynamic_df(raw_df)

    # Synthetic / artifact columns removed
    assert "Unnamed: 0" not in cleaned_df.columns
    # Cleaned columns exist
    assert "transaction_date" in cleaned_df.columns
    assert "region" in cleaned_df.columns
    assert cleaned_df["region"].iloc[0] == "North America"
    # Numeric strings converted to floats
    assert cleaned_df["price_string"].iloc[0] == 1200.50
    assert cleaned_df["price_string"].iloc[1] == 850.00
    assert cleaned_df["price_string"].iloc[2] == -300.00
    # Scientific values preserved as floats
    assert cleaned_df["scientific_val"].iloc[0] == 0.0012
    assert cleaned_df["scientific_val"].iloc[1] == -0.045
    assert cleaned_df["scientific_val"].iloc[2] == 100.0


@pytest.mark.asyncio
async def test_anti_pollution_shield_in_schema_semantics():
    """Verify that hallucinated/synthetic columns from LLM are strictly rejected and pruned."""
    mock_engine = MagicMock()
    mock_llm = MagicMock()
    
    # Simulate Groq LLM hallucinating fake columns ('fake_date', 'invented_revenue', 'synthetic_dim')
    mock_llm.generate = AsyncMock(return_value="""{
        "primary_date": "fake_date",
        "target_metric": "invented_revenue",
        "dimensions": ["synthetic_dim", "actual_region", "fake_store"],
        "numerical_columns": ["invented_sales", "actual_units", "actual_price"],
        "categorical_columns": ["fake_cat", "actual_channel"]
    }""")

    service = DynamicIngestionService(engine=mock_engine, llm_client=mock_llm)

    # Actual dataframe with real columns
    df = pd.DataFrame({
        "order_timestamp": pd.date_range("2024-01-01", periods=5),
        "actual_region": ["NA", "EMEA", "APAC", "LATAM", "NA"],
        "actual_channel": ["Direct", "Web", "Retail", "Partner", "Direct"],
        "actual_units": [10, 20, 30, 40, 50],
        "actual_price": [100.0, 150.0, 200.0, 250.0, 300.0]
    })

    dtypes = {col: str(df[col].dtype) for col in df.columns}
    resolved = await service._infer_schema_semantics(df, dtypes)

    # 1. Hallucinated primary_date 'fake_date' was rejected; real 'order_timestamp' picked
    assert resolved["primary_date"] == "order_timestamp"
    # 2. Hallucinated target_metric 'invented_revenue' was rejected; real numeric column picked
    assert resolved["target_metric"] in ("actual_units", "actual_price")
    # 3. Hallucinated dimensions 'synthetic_dim' and 'fake_store' were pruned
    assert "synthetic_dim" not in resolved["dimensions"]
    assert "fake_store" not in resolved["dimensions"]
    assert "actual_region" in resolved["dimensions"]
    # 4. Hallucinated numerical_column 'invented_sales' was pruned
    assert "invented_sales" not in resolved["numerical_columns"]
    # 5. Hallucinated categorical_column 'fake_cat' was pruned
    assert "fake_cat" not in resolved["categorical_columns"]


def test_table_schemas_rich_details_and_fallback_sql_compatibility():
    """Verify that get_table_schemas formatting is compatible with QueryService fallback regex."""
    import re
    # Sample schema produced by hardened get_table_schemas
    schema_context = """Table: dataset_e56e07cf (date DATE, sku_name VARCHAR, sales_channel VARCHAR, units_sold INTEGER, net_revenue NUMERIC)
  Row Count: 1840
  - date (DATE) [Primary Timeline Axis], Range: 2024-01-01 to 2025-12-31
  - sku_name (VARCHAR) [Categorical Dimension], Samples: ['AgileCobot Arm 600', 'Automated Guided Rover']
  - sales_channel (VARCHAR) [Categorical Dimension], Samples: ['Direct', 'E-Commerce', 'Partner']
  - units_sold (INTEGER) [Target Forecast Metric], Min: 1.00, Max: 85.00
  - net_revenue (NUMERIC) [Numeric Regressor], Min: 1200.00, Max: 45000.00

Table: sales (id VARCHAR, sale_date DATE, total_amount NUMERIC)
  Row Count: 50
  - id (VARCHAR) [General Column]
  - sale_date (DATE) [General Column]
  - total_amount (NUMERIC) [Numeric Regressor]"""

    # Test regex used by QueryService._generate_fallback_sql
    match = re.search(r'Table:\s*([^\s\(]+)\s*\(([^\)]+)\)', schema_context)
    assert match is not None
    table_name = match.group(1)
    raw_cols = match.group(2).split(',')
    cols = [c.strip().split()[0] for c in raw_cols if c.strip()]

    assert table_name == "dataset_e56e07cf"
    assert cols == ["date", "sku_name", "sales_channel", "units_sold", "net_revenue"]
    assert "Row Count: 1840" in schema_context
    assert "Primary Timeline Axis" in schema_context
    assert "Target Forecast Metric" in schema_context

