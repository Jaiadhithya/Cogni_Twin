"""Upload record entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from src.domain.value_objects.entity_type import EntityType

@dataclass
class UploadRecord:
    """Upload record entity."""
    id: UUID
    filename: str
    entity_type: EntityType
    row_count: int
    warning_count: int
    error_count: int
    status: Literal["processing", "completed", "failed"]
    column_mapping: dict[str, str] | None
    warnings: list[str] | None
    errors: list[str] | None
    created_at: datetime
