"""Validation logic for data ingestion."""

from pathlib import Path
from src.domain.exceptions import FileValidationError
from src.config import settings

def validate_file(file_path: str | Path, content_type: str | None = None) -> None:
    """
    Validate an uploaded file before parsing.
    
    Args:
        file_path: Path to the uploaded file
        content_type: MIME type from the upload request
        
    Raises:
        FileValidationError: If validation fails
    """
    path = Path(file_path)
    
    # 1. File extension
    if path.suffix.lower() != ".csv":
        raise FileValidationError(f"File must be a CSV file. Received: {path.suffix}")
        
    # 2. MIME type (if provided)
    if content_type:
        valid_mimes = {"text/csv", "text/plain", "application/csv", "application/octet-stream"}
        if content_type not in valid_mimes:
            raise FileValidationError(f"Invalid file type. Expected CSV.")
            
    # 3. File size
    if not path.exists():
        raise FileValidationError("File not found.")
        
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise FileValidationError(
            f"File size ({size_mb:.1f}MB) exceeds maximum allowed ({settings.MAX_UPLOAD_SIZE_MB}MB)."
        )
        
    # 4. Non-empty (at least 2 lines)
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            first_line = f.readline()
            second_line = f.readline()
            if not first_line or not second_line:
                raise FileValidationError("File is empty or contains only a header row.")
    except Exception as e:
        if isinstance(e, FileValidationError):
            raise
        raise FileValidationError(f"File could not be parsed as CSV. Error: {str(e)}")
