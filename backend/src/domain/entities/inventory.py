"""Inventory entity."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

@dataclass
class Inventory:
    """Inventory entity."""
    id: UUID
    product_id: UUID | None
    product_name: str | None
    quantity_on_hand: int
    reorder_level: int | None
    reorder_quantity: int | None
    warehouse_location: str | None
    last_restocked: date | None
    upload_id: UUID
    created_at: datetime
