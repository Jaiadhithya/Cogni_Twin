from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.infrastructure.database.session import get_db_session
from src.infrastructure.database.engine import engine
from src.services.ingestion import DynamicIngestionService
from src.dependencies import get_llm_client
from src.domain.interfaces.llm_client import LLMClient
from src.domain.exceptions import FileTooLargeError, ValidationError
from src.config import settings

router = APIRouter(prefix="/ingest", tags=["Dynamic Ingestion"])

@router.post("/csv")
async def ingest_csv(
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db_session),
    llm_client: LLMClient = Depends(get_llm_client)
):
    """
    Ingest an arbitrary CSV file dynamically with zero synthetic column pollution,
    robust date parsing (slashes, dots, epoch, ISO), and clean numeric formatting.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "INVALID_FILE_TYPE", "message": "Only CSV files are supported for dynamic ingestion."}
        )
    if hasattr(file, "size") and file.size is not None and file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"type": "FILE_TOO_LARGE", "message": f"File size exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit."}
        )
    service = DynamicIngestionService(engine=engine, llm_client=llm_client)
    try:
        result = await service.ingest_csv(file, db)
    except (FileTooLargeError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "FILE_VALIDATION_ERROR", "message": str(e)}
        )
    return result
