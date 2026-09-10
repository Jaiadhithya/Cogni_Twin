"""Re-export dynamic ingestion router for backward compatibility."""

from src.api.ingestion_router import router, ingest_csv

__all__ = ["router", "ingest_csv"]
