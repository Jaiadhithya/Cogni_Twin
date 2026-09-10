import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from src.services.rag_service import RAGService
from src.api.schemas.document import DocumentUploadResponse, DocumentSearchRequest, DocumentSearchResponse
from src.api.schemas.common import SuccessResponse
from src.dependencies import get_rag_service
from src.domain.exceptions import DocumentParseError, VectorStoreError
from src.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=SuccessResponse[DocumentUploadResponse])
async def upload_document(
    file: UploadFile = File(...),
    rag_service: RAGService = Depends(get_rag_service)
):
    """Upload a document, parse it, chunk it, and store in vector db."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"type": "ValidationError", "message": "No filename provided."})
        
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        result = await rag_service.upload_document(file_path, file.filename)
        return SuccessResponse(data=result)
        
    except DocumentParseError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"type": "DocumentParseError", "message": str(e)})
    except VectorStoreError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "VectorStoreError", "message": str(e)})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "UnexpectedError", "message": f"Unexpected error: {str(e)}"})

@router.post("/search", response_model=SuccessResponse[DocumentSearchResponse])
async def search_documents(
    request: DocumentSearchRequest,
    rag_service: RAGService = Depends(get_rag_service)
):
    """Semantic search against the vector database."""
    try:
        result = await rag_service.search_documents(request.query, request.top_k)
        return SuccessResponse(data=result)
    except VectorStoreError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "VectorStoreError", "message": str(e)})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"type": "UnexpectedError", "message": f"Unexpected error: {str(e)}"})
