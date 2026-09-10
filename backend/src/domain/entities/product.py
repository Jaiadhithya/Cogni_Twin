"""Product entity."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

@dataclass
class Product:
    """Product entity."""
    id: UUID
    name: str
    category: str | None
    subcategory: str | None
    sku: str | None
    unit_price: Decimal | None
    cost_price: Decimal | None
    description: str | None
    supplier_id: UUID | None
    upload_id: UUID
    created_at: datetime
