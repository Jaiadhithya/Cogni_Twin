"""Unit tests for Row Validator."""

import pandas as pd
from datetime import datetime, timedelta
from src.infrastructure.ingestion.row_validator import RowValidator

def test_validate_sales_future_date():
    future_date = pd.Timestamp(datetime.now() + timedelta(days=10))
    df = pd.DataFrame([{
        "sale_date": future_date,
        "quantity": 5,
        "unit_price": 10.0,
        "total_amount": 50.0
    }])
    
    valid, warnings, errors = RowValidator.validate(df, "sales")
    assert len(valid) == 1
    assert len(warnings) == 1
    assert "Future sale date" in warnings[0]
    assert len(errors) == 0

def test_validate_sales_negative_price():
    df = pd.DataFrame([{
        "sale_date": pd.Timestamp("2024-01-01"),
        "quantity": 5,
        "unit_price": -10.0,
        "total_amount": -50.0
    }])
    
    valid, warnings, errors = RowValidator.validate(df, "sales")
    assert len(valid) == 0
    assert len(errors) == 1
    assert "unit_price is negative" in errors[0]

def test_validate_customers_email():
    df = pd.DataFrame([{
        "name": "John Doe",
        "email": "invalid_email",
    }])
    
    valid, warnings, errors = RowValidator.validate(df, "customers")
    assert len(valid) == 1
    assert valid[0]["email"] is None
    assert len(warnings) == 1
    assert "email format invalid" in warnings[0]

def test_validate_inventory_missing_product():
    df = pd.DataFrame([{
        "quantity_on_hand": 10,
        "product_id": None,
        "product_name": None
    }])
    
    valid, warnings, errors = RowValidator.validate(df, "inventory")
    assert len(valid) == 0
    assert len(errors) == 1
    assert "missing required column" in errors[0]
