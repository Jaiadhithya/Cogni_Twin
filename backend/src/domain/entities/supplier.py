"""Supplier entity."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

@dataclass
class Supplier:
    """Supplier entity."""
    id: UUID
    name: str
    contact_person: str | None
    email: str | None
    phone: str | None
    city: str | None
    state: str | None
    lead_time_days: int | None
    rating: Decimal | None
    payment_terms: str | None
    upload_id: UUID
    created_at: datetime
