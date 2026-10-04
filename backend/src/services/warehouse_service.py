"""Warehouse service for data retrieval and metrics."""

import logging
from typing import Any, Dict, Optional
from datetime import date

from src.domain.interfaces.uow import UnitOfWork
from src.domain.value_objects import DateRange, EntityType, PaginatedResult, PaginationParams
from src.domain.entities import Dataset, UploadRecord

logger = logging.getLogger(__name__)

class WarehouseService:
    """Service for retrieving data and generating warehouse metrics."""

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_data(
        self,
        entity_type: EntityType,
        pagination: PaginationParams,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None
    ) -> PaginatedResult[Any]:
        """Get paginated data for an entity type."""
        date_range = None
        if date_from or date_to:
            date_range = DateRange(start_date=date_from, end_date=date_to)
            
        async with self.uow as uow:
            return await uow.repository.get_entities(
                entity_type=entity_type,
                pagination=pagination,
                date_range=date_range,
                sort_by=sort_by,
                sort_order=sort_order,
                search=search
            )

    async def get_uploads(self, pagination: PaginationParams) -> PaginatedResult[UploadRecord]:
        """Get paginated upload history from the legacy typed pipeline."""
        async with self.uow as uow:
            return await uow.repository.get_upload_records(pagination=pagination)

    async def get_datasets(self, pagination: PaginationParams) -> PaginatedResult[Dataset]:
        """Get paginated ingested datasets, newest first."""
        async with self.uow as uow:
            return await uow.repository.list_datasets(pagination=pagination)

    async def get_summary(
        self,
        dataset_id: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get dashboard summary metrics."""
        date_range = None
        if date_from or date_to:
            date_range = DateRange(start_date=date_from, end_date=date_to)
            
        async with self.uow as uow:
            return await uow.repository.get_summary_metrics(dataset_id=dataset_id, date_range=date_range)
