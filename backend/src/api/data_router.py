from typing import Optional, Any
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status

from src.domain.value_objects import EntityType, PaginationParams
from src.services.warehouse_service import WarehouseService
from src.dependencies import get_warehouse_service
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
    if dataset_id == "undefined":
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
    Get paginated upload history.
    """
    pagination = PaginationParams(page=page, page_size=page_size)
    result = await warehouse_service.get_uploads(pagination=pagination)
    
    meta = MetaSchema(
        pagination=PaginationMeta(
            page=result.page,
            page_size=result.page_size,
            total_count=result.total_count,
            total_pages=result.total_pages
        )
    )
    
    # We serialize the dataclass UploadRecord into a dict
    records = []
    for item in result.items:
        records.append({
            "id": str(item.id),
            "filename": item.filename,
            "entity_type": item.entity_type,
            "row_count": item.row_count,
            "warning_count": item.warning_count,
            "error_count": item.error_count,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else None
        })
        
    return SuccessResponse(data=EntityListResponseData(records=records), meta=meta)

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
