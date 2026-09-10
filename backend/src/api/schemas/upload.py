from typing import Optional, Dict
from pydantic import BaseModel, Field

class UploadResponseData(BaseModel):
    upload_id: str
    filename: str
    entity_type: str
    rows_ingested: int
    rows_skipped: int = 0
    warnings: list[str] = Field(default_factory=list)
    column_mapping: Dict[str, str] = Field(default_factory=dict)

class UploadStatusResponseData(BaseModel):
    id: str
    filename: str
    entity_type: str
    row_count: int
    warning_count: int
    error_count: int
    status: str
    created_at: str
