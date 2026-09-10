import os
import uuid
import time
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from pydantic import ValidationError

from src.domain.value_objects import EntityType
from src.services.ingestion_service import IngestionService
from src.dependencies import get_ingestion_service
from src.api.schemas.upload import UploadResponseData
from src.api.schemas.common import SuccessResponse, ErrorResponse, ErrorSchema, MetaSchema
from src.domain.exceptions import CogniTwinError, IngestionError, UnsupportedFileTypeError, FileTooLargeError, SchemaMapError
from src.config import settings

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/{entity_type}", response_model=SuccessResponse[UploadResponseData])
async def upload_file(
    entity_type: EntityType,
    file: UploadFile = File(...),
    ingestion_service: IngestionService = Depends(get_ingestion_service)
):
    """
    Upload a CSV file containing business data.
    """
    start_time = time.time()
    
    # 1. Validation before saving
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "FILE_VALIDATION_ERROR", "message": f"File must be a CSV file (received: {file.content_type})"}
        )
    
    # Check if we should enforce max file size early if possible (though we'll stream it)
    # 2. Save file temporarily
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    temp_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            # We chunk the read to avoid loading huge files entirely in memory at once
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
                if os.path.getsize(temp_path) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    raise FileTooLargeError(f"File size exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.")
                    
        # 3. Call ingestion service
        upload_record = await ingestion_service.ingest_file(
            file_path=temp_path,
            original_filename=file.filename,
            mime_type=file.content_type or "text/csv",
            entity_type=entity_type
        )
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        return SuccessResponse(
            data=UploadResponseData(
                upload_id=str(upload_record.id),
                filename=upload_record.filename,
                entity_type=upload_record.entity_type,
                rows_ingested=upload_record.row_count,
                rows_skipped=upload_record.error_count,
                warnings=upload_record.warnings or [],
                column_mapping=upload_record.column_mapping or {}
            ),
            meta=MetaSchema(processing_time_ms=processing_time_ms)
        )
        
    except (UnsupportedFileTypeError, FileTooLargeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "FILE_VALIDATION_ERROR", "message": str(e)}
        )
    except CogniTwinError:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"type": "INTERNAL_ERROR", "message": str(e)}
        )
    finally:
        # 4. Clean up temporary file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
