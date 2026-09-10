from fastapi import APIRouter, UploadFile, File, Depends
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
    service = DynamicIngestionService(engine=engine, llm_client=llm_client)
    result = await service.ingest_csv(file, db)
    return result
