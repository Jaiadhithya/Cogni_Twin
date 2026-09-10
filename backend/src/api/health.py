from fastapi import APIRouter
from src.config import settings
import os

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Health check endpoint that verifies system dependencies.
    """
    # Check model directory
    model_dir_accessible = os.path.isdir(settings.ML_MODELS_DIR) or os.access(os.path.dirname(settings.ML_MODELS_DIR) or ".", os.W_OK)
    
    # In a real implementation, we would try to connect to the database and ping the Gemini API.
    # For now, we return a mock status indicating what would be checked.
    db_status = "unverified"
    gemini_status = "unverified"
    
    status = "ok" if model_dir_accessible else "degraded"
    
    return {
        "status": status,
        "components": {
            "database": db_status,
            "model_directory": "accessible" if model_dir_accessible else "inaccessible",
            "gemini_api": gemini_status
        }
    }
