from pydantic import BaseModel
from typing import List, Dict, Any

class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    status: str

class DocumentSearchRequest(BaseModel):
    query: str
    top_k: int = 4

class ChunkResponse(BaseModel):
    chunk_id: str
    document_id: str
    score: float
    text: str
    metadata: Dict[str, Any]

class DocumentSearchResponse(BaseModel):
    results: List[ChunkResponse]
