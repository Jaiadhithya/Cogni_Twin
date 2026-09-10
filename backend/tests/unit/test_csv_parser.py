"""Unit tests for CSV parser."""

import os
import tempfile
import pytest
import pandas as pd
from src.infrastructure.ingestion.csv_parser import CSVParser
from src.infrastructure.ingestion.exceptions import FileValidationError

def test_validate_file_invalid_extension():
    with pytest.raises(FileValidationError, match="File must be a CSV file"):
        CSVParser.validate_file("test.xlsx", "text/csv", "test.xlsx")

def test_validate_file_invalid_mime():
    with pytest.raises(FileValidationError, match="Invalid file type"):
        CSVParser.validate_file("test.csv", "application/pdf", "test.csv")

def test_validate_file_empty(tmp_path):
    file_path = tmp_path / "empty.csv"
    file_path.write_text("")
    with pytest.raises(FileValidationError, match="File is empty"):
        CSVParser.validate_file(str(file_path), "text/csv", "empty.csv")

def test_validate_file_too_large(monkeypatch):
    monkeypatch.setattr(os.path, "getsize", lambda x: 60 * 1024 * 1024)
    with pytest.raises(FileValidationError, match="exceeds maximum allowed"):
        CSVParser.validate_file("test.csv", "text/csv", "test.csv")

def test_parse_valid_csv(tmp_path):
    content = "Name, Age\nJohn, 30\nJane, 25\n"
    file_path = tmp_path / "test.csv"
    file_path.write_text(content)
    
    df, warnings = CSVParser.parse(str(file_path))
    assert len(df) == 2
    assert "name" in df.columns
    assert "age" in df.columns
    assert not warnings

def test_parse_duplicate_columns(tmp_path):
    content = "Name, Age, Name\nJohn, 30, Doe\n"
    file_path = tmp_path / "dup.csv"
    file_path.write_text(content)
    
    df, warnings = CSVParser.parse(str(file_path))
    assert "name" in df.columns
    assert "name_1" in df.columns
    assert len(warnings) == 1
    assert "Duplicate column name" in warnings[0]
