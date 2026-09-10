"""Customer entity."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

@dataclass
class Customer:
    """Customer entity."""
    id: UUID
    name: str
    email: str | None
    phone: str | None
    city: str | None
    state: str | None
    segment: str | None
    first_purchase_date: date | None
    upload_id: UUID
    created_at: datetime
