from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.infrastructure.database.session import get_db_session
from src.infrastructure.database.engine import engine
from src.services.ingestion import DynamicIngestionService
from src.dependencies import get_llm_client
from src.domain.interfaces.llm_client import LLMClient

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
    service = DynamicIngestionService(engine=engine, llm_client=llm_client)
    result = await service.ingest_csv(file, db)
    return result
