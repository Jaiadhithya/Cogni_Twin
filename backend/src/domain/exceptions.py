"""Domain exceptions for CogniTwin."""

class CogniTwinError(Exception):
    """Base exception for all domain errors."""
    pass

class MlError(CogniTwinError):
    """Raised for errors in the ML pipeline (Prophet errors)."""
    pass

class LlmError(CogniTwinError):
    """Raised for LLM related errors."""
    pass

class ValidationError(CogniTwinError):
    """Data validation failed."""
    pass

class FileValidationError(ValidationError):
    """Uploaded file is invalid."""
    pass

class SchemaMapError(ValidationError):
    """Cannot map CSV to schema."""
    pass
    
class UnsupportedFileTypeError(ValidationError):
    pass
    
class FileTooLargeError(ValidationError):
    pass
    
class IngestionError(CogniTwinError):
    pass

class InsufficientDataError(CogniTwinError):
    """Not enough data for operation."""
    pass

class ForecastNotReadyError(CogniTwinError):
    """No trained model available."""
    pass

class QueryGenerationError(CogniTwinError):
    """LLM failed to generate SQL."""
    pass

class QueryExecutionError(CogniTwinError):
    """Generated SQL failed."""
    pass

class RateLimitError(CogniTwinError):
    """Too many requests."""
    pass

class ExternalServiceError(CogniTwinError):
    """External API failed."""
    pass

class DocumentParseError(CogniTwinError):
    """Failed to parse document."""
    pass

class VectorStoreError(CogniTwinError):
    """Vector store operation failed."""
    pass

class NotFoundError(CogniTwinError):
    """A requested resource does not exist."""
    pass

class DatasetNotFoundError(NotFoundError):
    """Dataset not found."""
    pass

class DocumentNotFoundError(CogniTwinError):
    """Document not found."""
    pass
