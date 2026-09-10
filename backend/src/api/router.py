from fastapi import APIRouter
from src.api.upload_router import router as upload_router
from src.api.data_router import router as data_router
from src.api.forecast_router import router as forecast_router
from src.api.query_router import router as query_router
from src.api.document_router import router as document_router
from src.api.explain_router import router as explain_router
from src.api.explain_prescribe_router import router as explain_prescribe_router
from src.api.routers.ingest import router as ingest_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(upload_router)
api_router.include_router(data_router)
api_router.include_router(forecast_router)
api_router.include_router(query_router)
api_router.include_router(document_router)
api_router.include_router(explain_router)
api_router.include_router(explain_prescribe_router)
api_router.include_router(ingest_router)
