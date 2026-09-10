from typing import TypeVar, Generic, Optional, Any
from pydantic import BaseModel, Field

T = TypeVar("T")

class ErrorDetail(BaseModel):
    """Details for a specific validation error or failure."""
    message: str | None = None
    # We allow arbitrary dictionary expansion for error details
    model_config = {"extra": "allow"}

class ErrorSchema(BaseModel):
    """Machine-readable error format."""
    type: str
    message: str
    details: list[Any] = Field(default_factory=list)

class ErrorResponse(BaseModel):
    """Standardized error response envelope."""
    status: str = "error"
    error: ErrorSchema

class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int
    page_size: int
    total_count: int
    total_pages: int

class MetaSchema(BaseModel):
    """Generic metadata wrapper that can include pagination or other stats."""
    pagination: Optional[PaginationMeta] = None
    processing_time_ms: Optional[int] = None
    # Allow extra fields for endpoints that need specific meta
    model_config = {"extra": "allow"}

class SuccessResponse(BaseModel, Generic[T]):
    """Standardized success response envelope."""
    status: str = "success"
    data: T
    meta: Optional[MetaSchema] = None
