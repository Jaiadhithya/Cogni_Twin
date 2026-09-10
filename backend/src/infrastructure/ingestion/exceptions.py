"""Ingestion engine exceptions."""

from src.domain.exceptions import CogniTwinError, ValidationError, IngestionError

class FileValidationError(IngestionError):
    """Raised when a file fails validation."""
    pass

class SchemaMappingError(ValidationError):
    """Raised when a schema mapping fails to map required columns."""
    pass
