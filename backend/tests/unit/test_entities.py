"""Unit tests for domain entities and value objects."""

from datetime import date, datetime
from uuid import uuid4
from decimal import Decimal

from src.domain.entities import Sale, Product, Customer, Supplier, Inventory, UploadRecord
from src.domain.value_objects import DateRange, PaginatedResult, ForecastPoint, IngestionResult, EntityType

def test_create_sale_entity():
    """Test creating a Sale entity."""
    sale_id = uuid4()
    upload_id = uuid4()
    sale = Sale(
        id=sale_id,
        sale_date=date(2024, 1, 1),
        product_id=None,
        customer_id=None,
        quantity=2,
        unit_price=Decimal("1500.00"),
        total_amount=Decimal("3000.00"),
        discount=Decimal("0"),
        payment_method="UPI",
        channel="Online",
        product_name="Earbuds",
        customer_name="Test Customer",
        upload_id=upload_id,
        created_at=datetime.utcnow()
    )
    
    assert sale.id == sale_id
    assert sale.quantity == 2
    assert sale.total_amount == Decimal("3000.00")

def test_entity_type_literals():
    """Test EntityType is correct."""
    types: list[EntityType] = ["sales", "products", "customers", "inventory", "suppliers"]
    assert len(types) == 5

def test_forecast_point():
    """Test ForecastPoint value object."""
    point = ForecastPoint(
        date=date(2024, 1, 1),
        predicted=100.0,
        lower_bound=90.0,
        upper_bound=110.0
    )
    
    assert point.predicted == 100.0
    assert point.lower_bound == 90.0

def test_ingestion_result():
    """Test IngestionResult value object."""
    result = IngestionResult(
        entity_type="sales",
        rows_ingested=10,
        rows_skipped=2,
        warning_count=1,
        error_count=0,
        column_mapping={"Date": "sale_date"},
        warnings=["Missing value"],
        errors=[]
    )
    
    assert result.rows_ingested == 10
    assert result.column_mapping["Date"] == "sale_date"
