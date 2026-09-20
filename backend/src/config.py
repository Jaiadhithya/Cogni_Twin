"""Application configuration settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import json
from typing import Any

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str
    DATABASE_READONLY_URL: str
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    
    GROQ_API_KEY: str = ""
    GROQ_MODEL_NAME: str = "openai/gpt-oss-120b"
    
    # ML and File Storage
    ML_MODELS_DIR: str = "./ml_models"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_UPLOAD_ROWS: int = 100000
    
    # Qdrant Vector Store
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "cognitwin_documents"
    
    # Forecasting
    FORECAST_HORIZON_MAX_DAYS: int = 90
    FORECAST_MIN_DATA_POINTS: int = 30
    
    # Queries
    QUERY_RATE_LIMIT: int = 10
    QUERY_TIMEOUT_SECONDS: int = 10
    
    # Server
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
    API_PREFIX: str = "/api/v1"
    API_KEY: str = ""

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        return v
    
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()
