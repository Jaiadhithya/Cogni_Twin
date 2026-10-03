import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request, status
from src.services.rag_service import RAGService
from src.api.schemas.document import DocumentUploadResponse, DocumentSearchRequest, DocumentSearchResponse
from src.api.schemas.common import SuccessResponse
from src.api.errors import internal_error
from src.dependencies import get_rag_service
from src.domain.exceptions import (
    DocumentParseError,
    FileTooLargeError,
    UnsupportedFileTypeError,
    ValidationError,
    VectorStoreError,
)
from src.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

_PDF_MAGIC = b"%PDF-"
_CHUNK_SIZE = 1024 * 1024


async def _save_pdf_upload(file: UploadFile, file_path: str) -> None:
    """Stream the upload to disk, enforcing the PDF type and size cap as bytes arrive."""
    max_bytes = settings.MAX_DOCUMENT_UPLOAD_SIZE_MB * 1024 * 1024
    written = 0
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(_CHUNK_SIZE):
            if written == 0 and not chunk.startswith(_PDF_MAGIC):
                raise UnsupportedFileTypeError("File content is not a PDF.")
            written += len(chunk)
            if written > max_bytes:
                raise FileTooLargeError(
                    f"Document exceeds {settings.MAX_DOCUMENT_UPLOAD_SIZE_MB}MB limit."
                )
            buffer.write(chunk)
    if written == 0:
        raise ValidationError("Uploaded file is empty.")

@router.post("/upload", response_model=SuccessResponse[DocumentUploadResponse])
async def upload_document(
    http_request: Request,
    file: UploadFile = File(...),
    rag_service: RAGService = Depends(get_rag_service)
):
    """Upload a document, parse it, chunk it, and store in vector db."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"type": "ValidationError", "message": "No filename provided."})
        
    if os.path.splitext(file.filename)[1].lower() != ".pdf":
        raise UnsupportedFileTypeError("Only PDF documents are supported.")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}.pdf")
    keep_file = False

    try:
        await _save_pdf_upload(file, file_path)
        result = await rag_service.upload_document(file_path, file.filename)
        keep_file = True
        return SuccessResponse(data=result)

    except DocumentParseError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"type": "DocumentParseError", "message": str(e)})
    except VectorStoreError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "VectorStoreError", "message": str(e)})
    except ValidationError:
        raise
    except Exception:
        raise internal_error(http_request, "documents/upload")
    finally:
        if not keep_file and os.path.exists(file_path):
            os.remove(file_path)

@router.post("/search", response_model=SuccessResponse[DocumentSearchResponse])
async def search_documents(
    http_request: Request,
    request: DocumentSearchRequest,
    rag_service: RAGService = Depends(get_rag_service)
):
    """Semantic search against the vector database."""
    try:
        result = await rag_service.search_documents(request.query, request.top_k)
        return SuccessResponse(data=result)
    except VectorStoreError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "VectorStoreError", "message": str(e)})
    except Exception:
        raise internal_error(http_request, "documents/search")
