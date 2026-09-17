import logging
import os

from fastapi import APIRouter
from sqlalchemy import text

from src.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


async def _check_database() -> str:
    try:
        import asyncio

        from src.infrastructure.database.session import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=3.0)
        return "healthy"
    except Exception as e:
        logger.warning(f"Health check: database unreachable ({type(e).__name__}: {e})")
        return f"unhealthy: {type(e).__name__}"


def _check_qdrant() -> str:
    try:
        from qdrant_client import QdrantClient

        client = QdrantClient(
            url=f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}",
            timeout=1.5,
        )
        try:
            client.get_collections()
        finally:
            client.close()
        return "reachable"
    except Exception as e:
        logger.warning(f"Health check: Qdrant unreachable ({type(e).__name__}: {e})")
        return f"unreachable: {type(e).__name__}"


def _check_llm_key() -> str:
    return "configured" if settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip() else "missing"


@router.get("/health")
async def health_check():
    """Health check that actively probes dependencies instead of asserting status."""
    model_dir_accessible = os.path.isdir(settings.ML_MODELS_DIR) or os.access(
        os.path.dirname(settings.ML_MODELS_DIR) or ".", os.W_OK
    )

    components = {
        "database": await _check_database(),
        "model_directory": "accessible" if model_dir_accessible else "inaccessible",
        "qdrant": _check_qdrant(),
        "llm_api_key": _check_llm_key(),
    }

    degraded = any(
        str(v).startswith(("unhealthy", "unreachable", "missing", "inaccessible"))
        for v in components.values()
    )

    return {
        "status": "degraded" if degraded else "ok",
        "components": components,
    }
