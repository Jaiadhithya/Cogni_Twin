import uuid
from typing import Optional, Any
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status

from src.domain.value_objects import EntityType, PaginationParams
from src.services.warehouse_service import WarehouseService
from src.dependencies import get_warehouse_service, get_dataset_service, get_dataset_analysis_service
from src.services.dataset_analysis_service import DatasetAnalysisService
from typing import Literal
from src.services.dataset_service import DatasetService
from src.api.schemas.common import SuccessResponse, ErrorResponse, PaginationMeta, MetaSchema
from src.api.schemas.data import EntityListResponseData, SummaryMetricsData

router = APIRouter(prefix="/data", tags=["Data"])

@router.get("/summary", response_model=SuccessResponse[Any])
async def get_summary(
    dataset_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    warehouse_service: WarehouseService = Depends(get_warehouse_service)
):
    """
    Get dynamic dashboard summary metrics for a specific dataset.
    """
    if dataset_id and str(dataset_id).strip().lower() in ("undefined", "null", "none", ""):
        dataset_id = None
        
    metrics = await warehouse_service.get_summary(dataset_id=dataset_id, date_from=date_from, date_to=date_to)
    return SuccessResponse(data=metrics)

@router.get("/uploads", response_model=SuccessResponse[EntityListResponseData])
async def get_uploads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    warehouse_service: WarehouseService = Depends(get_warehouse_service)
):
    """
    Get paginated datasets ingested through ``/ingest/csv``, newest first.

    Each record's ``id`` is the dataset id used by ``?dataset_id=`` elsewhere and by
    ``DELETE /data/uploads/{id}``. The record shape predates the schemaless pipeline,
    so ``entity_type`` is always ``"dynamic"``, ``status`` ``"completed"`` (ingestion is
    all-or-nothing) and the warning/error counts are 0.
    """
    pagination = PaginationParams(page=page, page_size=page_size)
    result = await warehouse_service.get_datasets(pagination=pagination)
    
    meta = MetaSchema(
        pagination=PaginationMeta(
            page=result.page,
            page_size=result.page_size,
            total_count=result.total_count,
            total_pages=result.total_pages
        )
    )
    
    records = [
        {
            "id": str(item.id),
            "filename": item.filename,
            "entity_type": "dynamic",
            "row_count": item.row_count,
            "warning_count": 0,
            "error_count": 0,
            "status": "completed",
            "created_at": item.uploaded_at.isoformat() if item.uploaded_at else None,
        }
        for item in result.items
    ]
        
    return SuccessResponse(data=EntityListResponseData(records=records), meta=meta)

@router.delete("/uploads/{upload_id}", response_model=SuccessResponse[Any])
async def undo_upload(
    upload_id: uuid.UUID,
    dataset_service: DatasetService = Depends(get_dataset_service),
):
    """
    Undo an upload: drop the dataset's table, metadata, cached schema context and trained models.
    """
    result = await dataset_service.delete_dataset(str(upload_id))
    return SuccessResponse(data=result)

@router.get("/{dataset_id}/profile", response_model=SuccessResponse[Any])
async def get_dataset_profile(
    dataset_id: uuid.UUID,
    service: DatasetAnalysisService = Depends(get_dataset_analysis_service),
):
    """Per-column statistics: numeric (count, nulls, mean, median, std, min/max, IQR, skewness) and categorical (cardinality, top values)."""
    return SuccessResponse(data=await service.profile(str(dataset_id)))

@router.get("/{dataset_id}/correlations", response_model=SuccessResponse[Any])
async def get_dataset_correlations(
    dataset_id: uuid.UUID,
    method: Literal["pearson", "spearman"] = "pearson",
    service: DatasetAnalysisService = Depends(get_dataset_analysis_service),
):
    """Correlation matrix over numeric columns with the pairwise sample size of every cell."""
    return SuccessResponse(data=await service.correlations(str(dataset_id), method))

@router.get("/{dataset_id}/scatter", response_model=SuccessResponse[Any])
async def get_dataset_scatter(
    dataset_id: uuid.UUID,
    x: str,
    y: str,
    limit: int = Query(500, ge=1, le=5000),
    service: DatasetAnalysisService = Depends(get_dataset_analysis_service),
):
    """Random sample of (x, y) points for two numeric columns, plus the Pearson r over all pairs."""
    return SuccessResponse(data=await service.scatter(str(dataset_id), x, y, limit))

@router.get("/{entity_type}", response_model=SuccessResponse[EntityListResponseData])
async def get_data(
    entity_type: EntityType,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    warehouse_service: WarehouseService = Depends(get_warehouse_service)
):
    """
    Get paginated data for an entity type.
    """
    pagination = PaginationParams(page=page, page_size=page_size)
    
    result = await warehouse_service.get_data(
        entity_type=entity_type,
        pagination=pagination,
        sort_by=sort_by,
        sort_order=sort_order,
        date_from=date_from,
        date_to=date_to,
        search=search
    )
    
    if result.total_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"type": "NOT_FOUND", "message": f"No {entity_type} data found. Upload a {entity_type} CSV file first."}
        )
        
    meta = MetaSchema(
        pagination=PaginationMeta(
            page=result.page,
            page_size=result.page_size,
            total_count=result.total_count,
            total_pages=result.total_pages
        )
    )
    
    # We serialize dataclass objects to dicts
    import dataclasses
    records = []
    for item in result.items:
        dict_item = dataclasses.asdict(item)
        # Convert any date/datetime objects to strings
        for k, v in dict_item.items():
            if hasattr(v, "isoformat"):
                dict_item[k] = v.isoformat()
            if isinstance(v, uuid.UUID):
                dict_item[k] = str(v)
        records.append(dict_item)
        
    return SuccessResponse(data=EntityListResponseData(records=records), meta=meta)
