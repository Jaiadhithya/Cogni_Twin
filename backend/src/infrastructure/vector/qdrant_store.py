import logging
import uuid
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct, VectorParams, Distance

from src.domain.interfaces.vector_store import VectorStore
from src.domain.value_objects.vector_search_result import VectorSearchResult
from src.domain.exceptions import VectorStoreError
from src.config import settings

logger = logging.getLogger(__name__)

class QdrantVectorStore(VectorStore):
    """Qdrant vector store implementation using fastembed."""

    def __init__(self):
        try:
            self.collection_name = settings.QDRANT_COLLECTION
            
            # Connect to dedicated Qdrant server or fallback to in-memory store
            try:
                self.client = QdrantClient(
                    url=f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}",
                    timeout=1.0
                )
                self.client.get_collections()
            except Exception:
                logger.info("Remote Qdrant server not reachable; using in-memory Qdrant instance")
                self.client = QdrantClient(":memory:")

            from fastembed import TextEmbedding
            self.embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            self._vector_size = 384

            self._vector_name = None
            if not self.client.collection_exists(self.collection_name):
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self._vector_size, distance=Distance.COSINE),
                )
            else:
                col_info = self.client.get_collection(self.collection_name)
                if isinstance(col_info.config.params.vectors, dict):
                    self._vector_name = next(iter(col_info.config.params.vectors.keys()), None)
        except Exception as e:
            logger.error(f"Failed to initialize QdrantVectorStore: {e}")
            raise VectorStoreError(f"Failed to initialize Qdrant: {e}")

    def upsert_vectors(self, document_id: str, chunks: List[Dict[str, Any]]) -> None:
        try:
            if not chunks:
                return

            texts = [c.get("text", "") for c in chunks]
            embeddings = list(self.embedder.embed(texts))
            points = []

            for i, chunk in enumerate(chunks):
                cid = chunk.get("chunk_id")
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{document_id}_{cid or i}"))
                meta = dict(chunk.get("metadata", {}))
                meta["document_id"] = document_id
                meta["chunk_id"] = str(cid or i)
                meta["text"] = chunk.get("text", "")

                vec_data = {self._vector_name: embeddings[i].tolist()} if self._vector_name else embeddings[i].tolist()
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=vec_data,
                        payload=meta,
                    )
                )

            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
            )
        except Exception as e:
            logger.error(f"Failed to upsert vectors: {e}")
            raise VectorStoreError(f"Failed to upsert vectors for document {document_id}: {e}")

    def search_vectors(self, query_text: str, top_k: int = 5) -> List[VectorSearchResult]:
        try:
            query_vector = list(self.embedder.embed([query_text]))[0].tolist()
            query_kwargs = {
                "collection_name": self.collection_name,
                "query": query_vector,
                "limit": top_k,
            }
            if self._vector_name:
                query_kwargs["using"] = self._vector_name
            res = self.client.query_points(**query_kwargs)

            search_results = []
            for p in res.points:
                payload = p.payload or {}
                search_results.append(VectorSearchResult(
                    chunk_id=str(payload.get("chunk_id", p.id)),
                    document_id=str(payload.get("document_id", "")),
                    score=float(p.score or 0.0),
                    text=str(payload.get("text", "")),
                    metadata=payload
                ))
            return search_results
        except Exception as e:
            logger.error(f"Failed to search vectors: {e}")
            raise VectorStoreError(f"Failed to search vectors: {e}")

    def delete_vectors(self, document_id: str) -> None:
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id)
                        )
                    ]
                )
            )
        except Exception as e:
            logger.error(f"Failed to delete vectors: {e}")
            raise VectorStoreError(f"Failed to delete vectors for document {document_id}: {e}")
