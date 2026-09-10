from typing import AsyncGenerator
from fastapi import Depends

from src.infrastructure.database.session import AsyncSessionLocal
from src.infrastructure.database.uow import SqlAlchemyUnitOfWork
from src.infrastructure.ingestion.csv_parser import CSVParser
from src.infrastructure.ingestion.schema_mapper import SchemaMapper
from src.infrastructure.ingestion.data_cleaner import DataCleaner
from src.infrastructure.ingestion.row_validator import RowValidator
from src.services.ingestion_service import IngestionService
from src.services.warehouse_service import WarehouseService
from src.services.query_service import QueryService
from src.services.forecast_service import ForecastService
from src.infrastructure.llm.groq_client import GroqClient
from src.infrastructure.ml.model_storage import JsonModelStorage
from src.infrastructure.ml.prophet_forecaster import ProphetForecaster
from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.forecaster import Forecaster
from src.domain.interfaces.llm_client import LLMClient

async def get_uow() -> AsyncGenerator[UnitOfWork, None]:
    """Dependency to provide a UnitOfWork instance."""
    uow = SqlAlchemyUnitOfWork(AsyncSessionLocal)
    yield uow

def get_ingestion_service(uow: UnitOfWork = Depends(get_uow)) -> IngestionService:
    """Dependency to provide IngestionService."""
    parser = CSVParser
    mapper = SchemaMapper()
    cleaner = DataCleaner()
    validator = RowValidator()
    return IngestionService(uow=uow, parser=parser, mapper=mapper, cleaner=cleaner, validator=validator)

def get_warehouse_service(uow: UnitOfWork = Depends(get_uow)) -> WarehouseService:
    """Dependency to provide WarehouseService."""
    return WarehouseService(uow=uow)

def get_llm_client() -> GroqClient:
    """Dependency to provide LLMClient."""
    return GroqClient()



def get_model_storage() -> JsonModelStorage:
    return JsonModelStorage()

def get_forecaster(storage: JsonModelStorage = Depends(get_model_storage)) -> ProphetForecaster:
    return ProphetForecaster(storage=storage)

def get_forecast_service(
    uow: UnitOfWork = Depends(get_uow),
    forecaster: Forecaster = Depends(get_forecaster)
) -> ForecastService:
    return ForecastService(uow=uow, forecaster=forecaster)

from src.infrastructure.document.pdf_extractor import PyMuPDFExtractor
from src.infrastructure.vector.qdrant_store import QdrantVectorStore
from src.services.rag_service import RAGService
from src.domain.interfaces.document_parser import DocumentParser
from src.domain.interfaces.vector_store import VectorStore

def get_document_parser() -> DocumentParser:
    return PyMuPDFExtractor()

_vector_store_instance = None
def get_vector_store() -> VectorStore:
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = QdrantVectorStore()
    return _vector_store_instance

def get_rag_service(
    uow: UnitOfWork = Depends(get_uow),
    document_parser: DocumentParser = Depends(get_document_parser),
    vector_store: VectorStore = Depends(get_vector_store),
    llm_client: LLMClient = Depends(get_llm_client)
) -> RAGService:
    return RAGService(uow=uow, document_parser=document_parser, vector_store=vector_store, llm_client=llm_client)

from src.infrastructure.ml.shap_engine import ShapEngine
from src.services.shap_explainer_service import ShapExplainerService
from src.domain.interfaces.explainer_engine import ExplainerEngine

def get_shap_engine() -> ExplainerEngine:
    return ShapEngine()

def get_shap_explainer_service(
    uow: UnitOfWork = Depends(get_uow),
    explainer_engine: ExplainerEngine = Depends(get_shap_engine),
    llm_client: LLMClient = Depends(get_llm_client),
    rag_service: RAGService = Depends(get_rag_service),
    forecaster: Forecaster = Depends(get_forecaster)
) -> ShapExplainerService:
    return ShapExplainerService(
        uow=uow,
        explainer_engine=explainer_engine,
        llm_client=llm_client,
        rag_service=rag_service,
        forecaster=forecaster
    )

# --- Phase 6: Prescriptive Service ---
from src.services.prescriptive_service import PrescriptiveService

def get_prescriptive_service(
    forecast_service: ForecastService = Depends(get_forecast_service),
    shap_service: ShapExplainerService = Depends(get_shap_explainer_service),
    llm_client: LLMClient = Depends(get_llm_client),
    forecaster: Forecaster = Depends(get_forecaster)
) -> PrescriptiveService:
    """Phase 6: Dependency to provide PrescriptiveService."""
    return PrescriptiveService(
        forecast_service=forecast_service,
        shap_service=shap_service,
        llm_client=llm_client,
        forecaster=forecaster
    )

def get_query_service(
    uow: UnitOfWork = Depends(get_uow),
    llm_client: LLMClient = Depends(get_llm_client),
    rag_service: RAGService = Depends(get_rag_service),
    shap_service: ShapExplainerService = Depends(get_shap_explainer_service),
    forecast_service: ForecastService = Depends(get_forecast_service),
    prescriptive_service: PrescriptiveService = Depends(get_prescriptive_service),
) -> QueryService:
    """Dependency to provide QueryService with Prescriptive intelligence."""
    return QueryService(
        uow=uow, 
        llm_client=llm_client, 
        rag_service=rag_service, 
        shap_service=shap_service,
        forecast_service=forecast_service,
        prescriptive_service=prescriptive_service,
    )

