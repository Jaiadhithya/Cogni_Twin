"""Sale entity."""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

@dataclass
class Sale:
    """Sale entity."""
    id: UUID
    sale_date: date
    product_id: UUID | None
    customer_id: UUID | None
    quantity: int
    unit_price: Decimal
    total_amount: Decimal
    discount: Decimal | None
    payment_method: str | None
    channel: str | None
    product_name: str | None
    customer_name: str | None
    upload_id: UUID
    created_at: datetime
    category: str | None = None
