"""Repository protocol."""

from typing import Protocol, Any
from src.domain.entities import UploadRecord
from src.domain.value_objects import DateRange, PaginatedResult, PaginationParams, EntityType

class Repository(Protocol):
    """Database repository protocol."""
    
    async def save_upload_record(self, record: UploadRecord) -> None:
        ...
        
    async def save_entities(self, entity_type: EntityType, entities: list[Any]) -> None:
        ...
        
    async def get_entities(
        self, 
        entity_type: EntityType, 
        pagination: PaginationParams, 
        date_range: DateRange | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        search: str | None = None
    ) -> PaginatedResult[Any]:
        ...
        
    async def get_upload_records(
        self,
        pagination: PaginationParams
    ) -> PaginatedResult[UploadRecord]:
        """Get a paginated list of upload records."""
        ...
        
    async def get_summary_metrics(
        self,
        date_range: DateRange | None = None
    ) -> dict[str, Any]:
        """Get summary metrics for the warehouse dashboard."""
        ...
        
    async def get_table_schemas(self, dataset_id: str | None = None) -> str:
        ...
        
    async def execute_readonly_sql(self, sql: str, limit: int = 1000) -> list[dict[str, Any]]:
        ...

    async def save_document(self, document_data: dict[str, Any]) -> str:
        """Save document metadata to the database. Returns the new document ID."""
        ...

    async def get_shap_cache(self, product_id: str, model_id: str) -> dict[str, Any] | None:
        """Get cached SHAP explanation."""
        ...

    async def save_shap_cache(self, cache_data: dict[str, Any]) -> None:
        """Save SHAP explanation to cache."""
        ...

    async def get_entities_by_names(self, entity_type: EntityType, names: list[str]) -> dict[str, Any]:
        """Fetch entity IDs by names in a single batch. Returns a dict mapping name -> UUID."""
        ...
