"""Dataset entity: one CSV ingested through the schemaless /ingest/csv pipeline."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass
class Dataset:
    """A dynamically ingested dataset (a row of ``dataset_metadata``)."""
    id: UUID
    filename: str
    row_count: int
    uploaded_at: datetime
    column_mapping: dict[str, Any] | None
