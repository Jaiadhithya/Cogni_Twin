from abc import ABC, abstractmethod
from typing import List, Dict, Any
from src.domain.value_objects.vector_search_result import VectorSearchResult

class VectorStore(ABC):
    """Abstract interface for vector similarity search."""
    
    @abstractmethod
    def upsert_vectors(self, document_id: str, chunks: List[Dict[str, Any]]) -> None:
        pass
        
    @abstractmethod
    def search_vectors(self, query_text: str, top_k: int = 5) -> List[VectorSearchResult]:
        pass
        
    @abstractmethod
    def delete_vectors(self, document_id: str) -> None:
        pass
