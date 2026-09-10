from dataclasses import dataclass
from typing import Dict, Any

@dataclass(frozen=True)
class VectorSearchResult:
    """Value object defining chunk search results."""
    chunk_id: str
    document_id: str
    score: float
    text: str
    metadata: Dict[str, Any]
