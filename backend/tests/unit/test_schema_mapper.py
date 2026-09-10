"""Unit tests for Schema Mapper."""

import pytest
from src.infrastructure.ingestion.schema_mapper import SchemaMapper
from src.infrastructure.ingestion.exceptions import SchemaMappingError

def test_schema_mapper_exact_match():
    mapper = SchemaMapper()
    columns = ["sale_date", "quantity", "unit_price", "total_amount"]
    mapping, warnings = mapper.map_columns("sales", columns)
    
    assert mapping["sale_date"] == "sale_date"
    assert mapping["quantity"] == "quantity"
    assert not warnings

def test_schema_mapper_alias_match():
    mapper = SchemaMapper()
    columns = ["transaction date", "qty", "selling price", "revenue"]
    mapping, warnings = mapper.map_columns("sales", columns)
    
    assert mapping["transaction date"] == "sale_date"
    assert mapping["qty"] == "quantity"
    assert mapping["selling price"] == "unit_price"
    assert mapping["revenue"] == "total_amount"
    assert len(warnings) == 4 # fuzzy matches

def test_schema_mapper_missing_required():
    mapper = SchemaMapper()
    columns = ["product", "customer", "total_amount"]
    with pytest.raises(SchemaMappingError, match="Required columns could not be mapped"):
        mapper.map_columns("sales", columns)

def test_schema_mapper_fuzzy_match():
    mapper = SchemaMapper(min_confidence=0.5)
    columns = ["Sale_Dat", "Qty Sold", "Unit Prce"]
    mapping, warnings = mapper.map_columns("sales", columns)
    
    assert mapping["Sale_Dat"] == "sale_date"
    assert mapping["Qty Sold"] == "quantity"
    assert mapping["Unit Prce"] == "unit_price"
