"""A vector store that connects on first use instead of at construction.

Services such as /query and explain-prescribe receive a vector store through dependency
injection even when the request never touches documents. Connecting eagerly made every
one of those requests fail (after a timeout) whenever Qdrant was down. This wrapper defers
the connection to the first real vector operation, and remembers a failed connection for
``RETRY_AFTER_SECONDS`` so an outage costs one timeout, not one per request.
"""

import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from src.domain.exceptions import VectorStoreError
from src.domain.interfaces.vector_store import VectorStore
from src.domain.value_objects.vector_search_result import VectorSearchResult

logger = logging.getLogger(__name__)

RETRY_AFTER_SECONDS = 30.0
UNAVAILABLE_MESSAGE = "Document search is unavailable right now. Try again in a minute."


class LazyVectorStore(VectorStore):
    def __init__(self, factory: Callable[[], VectorStore], clock: Callable[[], float] = time.monotonic):
        self._factory = factory
        self._clock = clock
        self._store: Optional[VectorStore] = None
        self._failed_at: Optional[float] = None
        self._lock = threading.Lock()

    def _get(self) -> VectorStore:
        with self._lock:
            if self._store is not None:
                return self._store
            if self._failed_at is not None and self._clock() - self._failed_at < RETRY_AFTER_SECONDS:
                raise VectorStoreError(UNAVAILABLE_MESSAGE)
            try:
                self._store = self._factory()
                self._failed_at = None
                return self._store
            except Exception as e:
                self._failed_at = self._clock()
                logger.warning(f"Vector store unavailable: {e}")
                raise VectorStoreError(UNAVAILABLE_MESSAGE) from e

    def upsert_vectors(self, document_id: str, chunks: List[Dict[str, Any]]) -> None:
        self._get().upsert_vectors(document_id, chunks)

    def search_vectors(self, query_text: str, top_k: int = 5) -> List[VectorSearchResult]:
        return self._get().search_vectors(query_text, top_k)

    def delete_vectors(self, document_id: str) -> None:
        self._get().delete_vectors(document_id)
