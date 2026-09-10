"""Ingestion result value object."""

from dataclasses import dataclass

@dataclass(frozen=True)
class IngestionResult:
    """Result of a data ingestion operation."""
    entity_type: str
    rows_ingested: int
    rows_skipped: int
    warning_count: int
    error_count: int
    column_mapping: dict[str, str]
    warnings: list[str]
    errors: list[str]
