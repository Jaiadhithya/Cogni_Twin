# Phase 2 — RAG Engine & Explainable AI (SHAP): Complete Implementation Specification

> **Document Purpose**: Zero-abstraction implementation blueprint for Phase 2. Every class name, method signature, database schema, vector payload, API contract, system prompt, and file location is explicitly defined. An AI coding agent must be able to implement this module-by-module without guessing.

> **Prerequisite**: Phase 1 is 100% complete and running. The backend uses FastAPI with Clean Architecture (`domain/`, `infrastructure/`, `services/`, `api/`), SQLite (via `aiosqlite`), Groq LLM (`llama-3.3-70b-versatile` for SQL, `llama-3.1-8b-instant` for formatting), and Prophet forecasting.

---

## SECTION 1: SYSTEM ARCHITECTURE & DATA FLOW

### 1.1 High-Level Architecture (Phase 2 Additions)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                           │
│                        Port 3000                                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────────┐ │
│  │  Upload   │  │Dashboard │  │ Forecast  │  │   Q&A Chat         │ │
│  │  Page     │  │  Page    │  │   Page    │  │  (Enhanced w/ RAG) │ │
│  └──────────┘  └──────────┘  └───────────┘  └────────────────────┘ │
│  ┌────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  Document Upload   │  │  Forecast Explainability Panel       │   │
│  │  (PDF) [NEW]       │  │  (SHAP Bullets) [NEW]                │   │
│  └────────────────────┘  └──────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP (REST JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                               │
│                      Port 8000                                       │
│                                                                      │
│  ┌─── API Layer (Routers) ─────────────────────────────────────────┐ │
│  │  /api/v1/upload    /api/v1/data    /api/v1/forecast             │ │
│  │  /api/v1/query     /api/v1/health                               │ │
│  │  /api/v1/documents/upload   [NEW]                               │ │
│  │  /api/v1/documents/search   [NEW]                               │ │
│  │  /api/v1/forecast/explain/{product_id}  [NEW]                   │ │
│  └────────────────────────┬────────────────────────────────────────┘ │
│                           │                                          │
│  ┌─── Service Layer ──────┴────────────────────────────────────────┐ │
│  │  IngestionService  WarehouseService  ForecastService             │ │
│  │  QueryService (MODIFIED — routing logic)                        │ │
│  │  RAGService [NEW]       ShapExplainerService [NEW]              │ │
│  └────────────────────────┬────────────────────────────────────────┘ │
│                           │                                          │
│  ┌─── Domain Layer ───────┴────────────────────────────────────────┐ │
│  │  Entities    Value Objects    Interfaces (Ports)                 │ │
│  │  + Document [NEW]   + ShapExplanation [NEW]                     │ │
│  │  + VectorSearchResult [NEW]                                     │ │
│  │  + VectorStore protocol [NEW]                                   │ │
│  │  + DocumentParser protocol [NEW]                                │ │
│  │  + ExplainerEngine protocol [NEW]                               │ │
│  └────────────────────────┬────────────────────────────────────────┘ │
│                           │                                          │
│  ┌─── Infrastructure Layer ────────────────────────────────────────┐ │
│  │  PostgresRepository   ProphetForecaster   GroqClient            │ │
│  │  CSVParser            FileStorage         ModelStorage           │ │
│  │  PDFExtractor [NEW]   QdrantVectorStore [NEW]                   │ │
│  │  ShapEngine [NEW]                                               │ │
│  └────────────────────────┬────────────────────────────────────────┘ │
│                           │                                          │
└───────────────────────────┼────────────────────────────────────────┘
                            │
              ┌─────────────┼────────────────────┐
              ▼             ▼                    ▼
        ┌──────────┐  ┌──────────┐    ┌──────────────────┐
        │ SQLite   │  │  Model   │    │  Groq LLM API    │
        │(cognitwin│  │  Store   │    │  (External)      │
        │.db)      │  │(Disk /ml)│    │                  │
        └──────────┘  └──────────┘    └──────────────────┘
              ▼
        ┌──────────────────┐
        │  Qdrant (Local   │  [NEW]
        │  Disk, Port 6333)│
        │  + FastEmbed     │
        │  ONNX CPU        │
        └──────────────────┘
```

### 1.2 Sequence Diagram: Document Upload → Qdrant Indexing

```
User                Frontend            Backend API              PDFExtractor         RAGService           Qdrant
 │                     │                    │                        │                    │                  │
 │── Upload PDF ──────>│                    │                        │                    │                  │
 │                     │── POST /api/v1/    │                        │                    │                  │
 │                     │   documents/upload─>│                        │                    │                  │
 │                     │                    │── validate file ──────>│                    │                  │
 │                     │                    │   (type, size)         │                    │                  │
 │                     │                    │                        │                    │                  │
 │                     │                    │── extract_markdown() ──>│                    │                  │
 │                     │                    │                        │── PyMuPDF4LLM ────>│                  │
 │                     │                    │                        │   parse PDF to MD  │                  │
 │                     │                    │<── markdown_text ──────│                    │                  │
 │                     │                    │                        │                    │                  │
 │                     │                    │── rag_service.ingest_document() ───────────>│                  │
 │                     │                    │                        │                    │                  │
 │                     │                    │                        │                    │── chunk_text()   │
 │                     │                    │                        │                    │   (500 words)    │
 │                     │                    │                        │                    │                  │
 │                     │                    │                        │                    │── tag_metadata() │
 │                     │                    │                        │                    │   per chunk      │
 │                     │                    │                        │                    │                  │
 │                     │                    │                        │                    │── upsert_chunks()>│
 │                     │                    │                        │                    │   (embed via     │
 │                     │                    │                        │                    │   FastEmbed +    │
 │                     │                    │                        │                    │   store)         │
 │                     │                    │                        │                    │<── ack ──────────│
 │                     │                    │                        │                    │                  │
 │                     │                    │── save document_meta to SQLite ────────────>│                  │
 │                     │                    │                        │                    │                  │
 │                     │<── 201 Created ────│                        │                    │                  │
 │<── Upload Success ──│                    │                        │                    │                  │
```

### 1.3 Sequence Diagram: Query Routing → Fused Multi-Source Answer

```
User             Frontend           QueryService             SQL Engine      Qdrant (RAG)    ShapExplainer    GroqClient
 │                  │                    │                       │                │                │              │
 │── "Why did       │                    │                       │                │                │              │
 │    sales drop    │                    │                       │                │                │              │
 │    for Widget X?"│                    │                       │                │                │              │
 │                  │── POST /query ────>│                       │                │                │              │
 │                  │                    │                       │                │                │              │
 │                  │                    │── classify_intent() ──────────────────────────────────────────────────>│
 │                  │                    │   (LLM routes to:     │                │                │              │
 │                  │                    │   SQL + SHAP + RAG)   │                │                │              │
 │                  │                    │<── intent: FUSED ─────────────────────────────────────────────────────│
 │                  │                    │                       │                │                │              │
 │                  │                    │── [SQL Path] ────────>│                │                │              │
 │                  │                    │   generate_sql()      │                │                │              │
 │                  │                    │   execute_sql()       │                │                │              │
 │                  │                    │<── sql_results ───────│                │                │              │
 │                  │                    │                       │                │                │              │
 │                  │                    │── [SHAP Path] ────────────────────────>│                │              │
 │                  │                    │   get_explanation(    │                │                │              │
 │                  │                    │     product_id)       │                │                │              │
 │                  │                    │<── shap_drivers ──────────────────────│                │              │
 │                  │                    │                       │                │                │              │
 │                  │                    │── [RAG Path] ─────────────────────────>│                │              │
 │                  │                    │   search(negative     │                │                │              │
 │                  │                    │   SHAP driver terms)  │                │                │              │
 │                  │                    │<── doc_context ───────────────────────│                │              │
 │                  │                    │                       │                │                │              │
 │                  │                    │── synthesize_answer() ────────────────────────────────────────────────>│
 │                  │                    │   (sql_results +      │                │                │              │
 │                  │                    │    shap_drivers +     │                │                │              │
 │                  │                    │    doc_context)       │                │                │              │
 │                  │                    │<── fused_answer ──────────────────────────────────────────────────────│
 │                  │                    │                       │                │                │              │
 │                  │<── QueryResponse ──│                       │                │                │              │
 │<── Answer ───────│                    │                       │                │                │              │
```

---

## SECTION 2: FILE & DIRECTORY TREE

### 2.1 New & Modified Files (Backend)

```
backend/src/
├── config.py                                  [MODIFY] — Add Qdrant, SHAP settings
├── dependencies.py                            [MODIFY] — Wire new services
├── main.py                                    [MODIFY] — Register new routers
│
├── api/
│   ├── router.py                              [MODIFY] — Include new sub-routers
│   ├── document_router.py                     [NEW]    — POST /documents/upload, POST /documents/search
│   ├── explain_router.py                      [NEW]    — GET /forecast/explain/{product_id}
│   └── schemas/
│       ├── document.py                        [NEW]    — Pydantic schemas for document endpoints
│       └── explain.py                         [NEW]    — Pydantic schemas for SHAP endpoints
│
├── domain/
│   ├── entities/
│   │   ├── document.py                        [NEW]    — Document entity
│   │   └── shap_explanation.py                [NEW]    — ShapExplanation entity
│   ├── value_objects/
│   │   ├── vector_search_result.py            [NEW]    — VectorSearchResult dataclass
│   │   └── query_intent.py                    [NEW]    — QueryIntent enum
│   ├── interfaces/
│   │   ├── vector_store.py                    [NEW]    — VectorStore protocol
│   │   ├── document_parser.py                 [NEW]    — DocumentParser protocol
│   │   └── explainer_engine.py                [NEW]    — ExplainerEngine protocol
│   └── exceptions.py                          [MODIFY] — Add new exception types
│
├── infrastructure/
│   ├── document/                              [NEW]    — Document processing
│   │   ├── __init__.py
│   │   └── pdf_extractor.py                   [NEW]    — PyMuPDF4LLM implementation
│   ├── vector/                                [NEW]    — Vector DB
│   │   ├── __init__.py
│   │   └── qdrant_store.py                    [NEW]    — Qdrant + FastEmbed implementation
│   └── ml/
│       └── shap_engine.py                     [NEW]    — SHAP TreeExplainer/KernelExplainer
│
├── services/
│   ├── query_service.py                       [MODIFY] — Add intent classification & routing
│   ├── rag_service.py                         [NEW]    — RAG pipeline orchestration
│   └── shap_explainer_service.py              [NEW]    — SHAP explanation orchestration
│
└── alembic/
    └── versions/
        └── xxxx_phase2_documents_shap.py      [NEW]    — Migration for documents + shap_cache tables
```

### 2.2 New & Modified Files (Frontend)

```
frontend/src/
├── app/
│   ├── documents/
│   │   └── page.tsx                           [NEW]    — Document upload & search page
│   └── forecast/
│       └── page.tsx                           [MODIFY] — Add SHAP explainability panel
│
├── components/
│   ├── documents/
│   │   ├── DocumentUpload.tsx                 [NEW]    — PDF drag-and-drop upload
│   │   ├── DocumentSearch.tsx                 [NEW]    — Document search interface
│   │   └── DocumentSearchResults.tsx          [NEW]    — Search results display
│   └── forecast/
│       └── ShapExplanationPanel.tsx           [NEW]    — SHAP bullet-point display
│
└── lib/
    └── api.ts                                 [MODIFY] — Add document & explain API methods
```

---

## SECTION 3: VECTOR & DATABASE SCHEMAS

### 3.1 Qdrant Collection Schema

**Collection Name**: `cognitwin_documents`

**Vector Configuration**:
```json
{
  "vectors": {
    "size": 384,
    "distance": "Cosine"
  },
  "optimizers_config": {
    "indexing_threshold": 20000
  },
  "on_disk_payload": true
}
```

**Point Payload Schema** (per vector point):

| Field | Type | Required | Description |
|---|---|---|---|
| `document_id` | `string` (UUID) | YES | FK to `documents` table in SQLite |
| `chunk_index` | `integer` | YES | 0-based index of this chunk within the document |
| `text_content` | `string` | YES | The actual chunk text (≤500 words) |
| `document_type` | `string` | YES | One of: `supplier_report`, `policy`, `market_analysis`, `invoice`, `general` |
| `document_title` | `string` | YES | Original filename without extension |
| `upload_timestamp` | `string` (ISO 8601) | YES | When the document was uploaded |
| `page_numbers` | `list[integer]` | NO | Source page numbers in the original PDF |
| `total_chunks` | `integer` | YES | Total number of chunks for this document |

**Embedding Model**: `BAAI/bge-small-en-v1.5` via FastEmbed (ONNX Runtime CPU)
- Dimensions: 384
- Max sequence length: 512 tokens
- Normalization: L2 (built into model)

### 3.2 SQLite Migration: `documents` Table

**Purpose**: Track document metadata. The actual content is in Qdrant; this provides relational queryability.

```sql
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'general',
    file_size_bytes INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing',
    error_message TEXT,
    upload_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS ix_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS ix_documents_created_at ON documents(created_at DESC);
```

### 3.3 SQLite Migration: `shap_cache` Table

**Purpose**: Cache pre-computed SHAP explanations per product per forecast run.

```sql
CREATE TABLE IF NOT EXISTS shap_cache (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_name TEXT,
    model_id TEXT NOT NULL,
    forecast_date TEXT NOT NULL,
    top_positive_drivers TEXT NOT NULL,    -- JSON array
    top_negative_drivers TEXT NOT NULL,    -- JSON array
    explanation_text TEXT,
    computed_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_shap_cache_product_id ON shap_cache(product_id);
CREATE INDEX IF NOT EXISTS ix_shap_cache_model_id ON shap_cache(model_id);
CREATE INDEX IF NOT EXISTS ix_shap_cache_forecast_date ON shap_cache(forecast_date);
```

---

## SECTION 4: DETAILED MODULE SPECIFICATIONS

### 4.1 PDF Extractor — [pdf_extractor.py](file:///c:/ML%20Project/backend/src/infrastructure/document/pdf_extractor.py)

**Class**: `PyMuPDFExtractor` implements `DocumentParser`

```python
"""PDF document extraction using PyMuPDF4LLM."""

import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Any

from src.domain.interfaces.document_parser import DocumentParser, ParsedDocument
from src.domain.exceptions import DocumentParseError

logger = logging.getLogger(__name__)


class PyMuPDFExtractor(DocumentParser):
    """Extract structured Markdown from PDF files using PyMuPDF4LLM."""

    SUPPORTED_EXTENSIONS: set[str] = {".pdf"}
    MAX_FILE_SIZE_MB: int = 100

    def supports(self, filename: str) -> bool:
        return Path(filename).suffix.lower() in self.SUPPORTED_EXTENSIONS

    async def parse(self, file_path: str) -> ParsedDocument:
        """
        Parse a PDF file into structured Markdown.
        Raises DocumentParseError on failure.
        """
        import pymupdf4llm
        import pymupdf

        path = Path(file_path)
        if not path.exists():
            raise DocumentParseError(f"File not found: {file_path}")
        if not path.suffix.lower() == ".pdf":
            raise DocumentParseError(f"Unsupported file type: {path.suffix}")

        file_size_mb = path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.MAX_FILE_SIZE_MB:
            raise DocumentParseError(
                f"File too large: {file_size_mb:.1f}MB (max {self.MAX_FILE_SIZE_MB}MB)"
            )

        try:
            markdown_text = pymupdf4llm.to_markdown(file_path)
            doc = pymupdf.open(file_path)
            page_count = len(doc)
            meta = doc.metadata or {}
            doc.close()

            metadata = {
                "title": meta.get("title", path.stem),
                "author": meta.get("author", ""),
                "creation_date": meta.get("creationDate", ""),
                "producer": meta.get("producer", ""),
            }

            logger.info(f"Parsed PDF: {path.name}, pages={page_count}, chars={len(markdown_text)}")

            return ParsedDocument(
                markdown_text=markdown_text,
                page_count=page_count,
                metadata=metadata,
            )
        except DocumentParseError:
            raise
        except Exception as e:
            logger.error(f"Failed to parse PDF {path.name}: {e}")
            raise DocumentParseError(f"Failed to parse PDF: {e}") from e
```

| Failure Condition | Exception | HTTP Status |
|---|---|---|
| File not found | `DocumentParseError` | 400 |
| Unsupported extension | `DocumentParseError` | 400 |
| File > 100MB | `DocumentParseError` | 400 |
| Corrupted/encrypted PDF | `DocumentParseError` | 400 |
| Empty PDF (0 pages) | `DocumentParseError` | 400 |

---

### 4.2 Qdrant Vector Store — [qdrant_store.py](file:///c:/ML%20Project/backend/src/infrastructure/vector/qdrant_store.py)

**Class**: `QdrantVectorStore` implements `VectorStore`

```python
"""Qdrant vector store with FastEmbed embedding."""

import logging
import uuid
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    models as qmodels,
)
from fastembed import TextEmbedding

from src.domain.interfaces.vector_store import VectorStore
from src.domain.value_objects.vector_search_result import VectorSearchResult
from src.domain.exceptions import VectorStoreError
from src.config import settings

logger = logging.getLogger(__name__)


class QdrantVectorStore(VectorStore):
    COLLECTION_NAME: str = "cognitwin_documents"
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    VECTOR_SIZE: int = 384

    def __init__(self):
        try:
            self.client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
            self.embedder = TextEmbedding(model_name=self.EMBEDDING_MODEL)
            self._ensure_collection()
            logger.info("QdrantVectorStore initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize QdrantVectorStore: {e}")
            raise VectorStoreError(f"Vector store initialization failed: {e}") from e

    def _ensure_collection(self) -> None:
        collections = self.client.get_collections().collections
        if self.COLLECTION_NAME not in [c.name for c in collections]:
            self.client.create_collection(
                collection_name=self.COLLECTION_NAME,
                vectors_config=VectorParams(size=self.VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info(f"Created Qdrant collection: {self.COLLECTION_NAME}")

    def _embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = list(self.embedder.embed(texts))
        return [e.tolist() for e in embeddings]

    async def upsert_chunks(self, document_id: str, chunks: list[dict[str, Any]]) -> int:
        if not chunks:
            return 0
        texts = [c["text_content"] for c in chunks]
        try:
            embeddings = self._embed(texts)
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=emb,
                    payload={
                        "document_id": document_id,
                        "chunk_index": chunk["chunk_index"],
                        "text_content": chunk["text_content"],
                        "document_type": chunk["document_type"],
                        "document_title": chunk["document_title"],
                        "upload_timestamp": chunk["upload_timestamp"],
                        "page_numbers": chunk.get("page_numbers", []),
                        "total_chunks": chunk["total_chunks"],
                    },
                )
                for chunk, emb in zip(chunks, embeddings)
            ]
            self.client.upsert(collection_name=self.COLLECTION_NAME, points=points)
            logger.info(f"Upserted {len(points)} chunks for document {document_id}")
            return len(points)
        except Exception as e:
            logger.error(f"Qdrant upsert failed: {e}")
            raise VectorStoreError(f"Failed to store document chunks: {e}") from e

    async def search(self, query_text: str, top_k: int = 5,
                     document_type: str | None = None, score_threshold: float = 0.35
                     ) -> list[VectorSearchResult]:
        try:
            query_embedding = self._embed([query_text])[0]
            search_filter = None
            if document_type:
                search_filter = Filter(must=[
                    FieldCondition(key="document_type", match=MatchValue(value=document_type))
                ])
            results = self.client.search(
                collection_name=self.COLLECTION_NAME,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=top_k,
                score_threshold=score_threshold,
            )
            return [
                VectorSearchResult(
                    document_id=hit.payload["document_id"],
                    chunk_index=hit.payload["chunk_index"],
                    text_content=hit.payload["text_content"],
                    document_type=hit.payload["document_type"],
                    document_title=hit.payload["document_title"],
                    score=hit.score,
                    page_numbers=hit.payload.get("page_numbers", []),
                )
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Qdrant search failed: {e}")
            raise VectorStoreError(f"Vector search failed: {e}") from e

    async def delete_document(self, document_id: str) -> None:
        try:
            self.client.delete(
                collection_name=self.COLLECTION_NAME,
                points_selector=qmodels.FilterSelector(
                    filter=Filter(must=[
                        FieldCondition(key="document_id", match=MatchValue(value=document_id))
                    ])
                ),
            )
            logger.info(f"Deleted all chunks for document {document_id}")
        except Exception as e:
            raise VectorStoreError(f"Failed to delete document: {e}") from e

    async def health_check(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False
```

| Failure Condition | Exception | HTTP Status |
|---|---|---|
| Qdrant unreachable | `VectorStoreError` | 503 |
| Embedding model load failure | `VectorStoreError` | 500 |
| Upsert timeout | `VectorStoreError` | 500 |
| Empty query text | Returns empty list | 200 |

---

### 4.3 RAG Service — [rag_service.py](file:///c:/ML%20Project/backend/src/services/rag_service.py)

**Class**: `RAGService`

```python
"""RAG pipeline: chunking, embedding, retrieval, and prompt context injection."""

import logging, uuid, re
from datetime import datetime, timezone
from typing import Any

from src.domain.interfaces.vector_store import VectorStore
from src.domain.interfaces.document_parser import DocumentParser
from src.domain.interfaces.llm_client import LLMClient
from src.domain.interfaces.uow import UnitOfWork
from src.domain.value_objects.vector_search_result import VectorSearchResult
from src.domain.exceptions import DocumentParseError, VectorStoreError

logger = logging.getLogger(__name__)


class RAGService:
    CHUNK_SIZE_WORDS: int = 500
    CHUNK_OVERLAP_WORDS: int = 50

    def __init__(self, uow: UnitOfWork, document_parser: DocumentParser,
                 vector_store: VectorStore, llm_client: LLMClient):
        self.uow = uow
        self.document_parser = document_parser
        self.vector_store = vector_store
        self.llm_client = llm_client

    def _chunk_text(self, text: str) -> list[dict[str, Any]]:
        """Split markdown text into overlapping chunks of ~500 words."""
        words = text.split()
        chunks, start = [], 0
        while start < len(words):
            end = min(start + self.CHUNK_SIZE_WORDS, len(words))
            chunk_text = " ".join(words[start:end])
            chunks.append({"text": chunk_text, "word_count": end - start, "start_word": start})
            if end >= len(words):
                break
            start += self.CHUNK_SIZE_WORDS - self.CHUNK_OVERLAP_WORDS
        return chunks

    def _classify_document_type(self, filename: str, text_preview: str) -> str:
        """Heuristic classification of document type."""
        fn = filename.lower()
        txt = text_preview[:2000].lower()
        if any(kw in fn for kw in ["supplier", "vendor", "procurement"]): return "supplier_report"
        if any(kw in fn for kw in ["policy", "guideline", "procedure", "sop"]): return "policy"
        if any(kw in fn for kw in ["market", "analysis", "research", "trend"]): return "market_analysis"
        if any(kw in fn for kw in ["invoice", "receipt", "bill", "po"]): return "invoice"
        if any(kw in txt for kw in ["supply chain", "lead time", "delivery"]): return "supplier_report"
        if any(kw in txt for kw in ["market share", "competitor"]): return "market_analysis"
        return "general"

    async def ingest_document(self, file_path: str, filename: str) -> dict[str, Any]:
        """Full pipeline: parse → chunk → embed → store → save metadata."""
        document_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        parsed = await self.document_parser.parse(file_path)
        if not parsed.markdown_text.strip():
            raise DocumentParseError("Document contains no extractable text.")

        doc_type = self._classify_document_type(filename, parsed.markdown_text)
        raw_chunks = self._chunk_text(parsed.markdown_text)
        total_chunks = len(raw_chunks)
        if total_chunks == 0:
            raise DocumentParseError("Document produced no text chunks.")

        chunk_payloads = [
            {
                "text_content": c["text"], "chunk_index": i,
                "document_type": doc_type,
                "document_title": filename.rsplit(".", 1)[0] if "." in filename else filename,
                "upload_timestamp": now, "page_numbers": [], "total_chunks": total_chunks,
            }
            for i, c in enumerate(raw_chunks)
        ]

        await self.vector_store.upsert_chunks(document_id, chunk_payloads)

        # Save metadata to SQLite documents table
        async with self.uow as uow:
            from pathlib import Path
            file_size = Path(file_path).stat().st_size
            await uow.repository.execute_readonly_sql(
                f"INSERT INTO documents (id, filename, document_type, file_size_bytes, page_count, "
                f"chunk_count, status, created_at) VALUES ('{document_id}', '{filename}', "
                f"'{doc_type}', {file_size}, {parsed.page_count}, {total_chunks}, 'indexed', '{now}')"
            )
            await uow.commit()

        logger.info(f"Ingested document: {filename}, id={document_id}, chunks={total_chunks}")
        return {
            "document_id": document_id, "filename": filename,
            "document_type": doc_type, "page_count": parsed.page_count,
            "chunk_count": total_chunks, "status": "indexed",
        }

    async def search_documents(self, query: str, top_k: int = 5,
                                document_type: str | None = None) -> list[VectorSearchResult]:
        return await self.vector_store.search(query_text=query, top_k=top_k, document_type=document_type)

    async def generate_rag_answer(self, question: str, search_results: list[VectorSearchResult],
                                   additional_context: str = "") -> str:
        """Generate an answer grounded in retrieved document context."""
        doc_parts = [
            f"[Source {i}: {r.document_title} (type: {r.document_type}, score: {r.score:.2f})]\n{r.text_content}"
            for i, r in enumerate(search_results, 1)
        ]
        doc_context = "\n---\n".join(doc_parts)

        # See Section 6.1 for the full prompt
        return await self.llm_client.format_answer(
            question=question, sql="N/A (document search)",
            results=[{"context": doc_context}],
        )
```

---

### 4.4 SHAP Engine — [shap_engine.py](file:///c:/ML%20Project/backend/src/infrastructure/ml/shap_engine.py)

**Class**: `ShapEngine` implements `ExplainerEngine`

```python
"""SHAP explainability engine — Prophet forecast decomposition."""

import logging
from typing import Any
from dataclasses import dataclass, asdict
import numpy as np, pandas as pd

from src.domain.interfaces.explainer_engine import ExplainerEngine
from src.domain.exceptions import MlError

logger = logging.getLogger(__name__)


@dataclass
class ShapDriver:
    feature: str        # e.g., "weekly", "trend", "yearly"
    contribution: float # Positive = upward push, Negative = downward
    description: str    # Human-readable label


@dataclass
class ShapExplanationResult:
    product_id: str | None
    product_name: str | None
    forecast_date: str
    predicted_value: float
    top_positive_drivers: list[ShapDriver]
    top_negative_drivers: list[ShapDriver]
    explanation_text: str | None  # Filled later by LLM


class ShapEngine(ExplainerEngine):
    """
    Extract Prophet forecast decomposition as SHAP-style feature contributions.
    Prophet decomposes yhat = trend + yearly + weekly + holidays + ...
    We rank these components by absolute magnitude.
    """
    COMPONENT_LABELS: dict[str, str] = {
        "trend": "Long-term business trend",
        "yearly": "Yearly seasonal pattern",
        "weekly": "Day-of-week effect",
        "holidays": "Holiday/event impact",
        "additive_terms": "Additional factors",
        "multiplicative_terms": "Scaling factors",
    }

    async def compute_explanation(self, model: Any, forecast_df: pd.DataFrame,
                                   target_date: str, product_id: str | None = None,
                                   product_name: str | None = None) -> ShapExplanationResult:
        try:
            target_dt = pd.Timestamp(target_date)
            mask = forecast_df["ds"].dt.date == target_dt.date()
            if not mask.any():
                raise MlError(f"Date {target_date} not found in forecast range.")

            row = forecast_df[mask].iloc[0]
            predicted_value = float(row["yhat"])

            components = {}
            for col in ["trend", "yearly", "weekly", "holidays",
                        "additive_terms", "multiplicative_terms"]:
                if col in forecast_df.columns:
                    val = float(row[col])
                    if abs(val) > 1e-6:
                        components[col] = val

            sorted_comp = sorted(components.items(), key=lambda x: abs(x[1]), reverse=True)

            positive, negative = [], []
            for feat, contrib in sorted_comp:
                d = ShapDriver(feature=feat, contribution=round(contrib, 4),
                               description=self.COMPONENT_LABELS.get(feat, feat))
                (positive if contrib > 0 else negative).append(d)

            return ShapExplanationResult(
                product_id=product_id, product_name=product_name,
                forecast_date=target_date, predicted_value=round(predicted_value, 2),
                top_positive_drivers=positive[:3], top_negative_drivers=negative[:3],
                explanation_text=None,
            )
        except MlError:
            raise
        except Exception as e:
            logger.error(f"SHAP computation failed: {e}")
            raise MlError(f"Failed to compute SHAP explanation: {e}") from e
```

---

### 4.5 SHAP Explainer Service — [shap_explainer_service.py](file:///c:/ML%20Project/backend/src/services/shap_explainer_service.py)

**Class**: `ShapExplainerService`

Orchestrates: check cache → load model → compute decomposition → LLM translate → RAG fusion for negative drivers → cache → return.

Key methods:
- `get_explanation(product_id, forecast_date) -> dict` — Full pipeline
- `_translate_to_natural_language(explanation) -> str` — Uses SHAP-to-NL prompt (Section 6.2)
- `_search_negative_driver_context(drivers) -> list[dict] | None` — Qdrant search for negative factors
- `_get_cached_explanation(product_id, forecast_date) -> dict | None` — SQLite cache lookup
- `_cache_explanation(explanation) -> None` — SQLite cache write

See full implementation in Section 4.5 of the companion detailed spec.

---

### 4.6 Modified QueryService — Intent Classification & Multi-Source Routing

The existing [query_service.py](file:///c:/ML%20Project/backend/src/services/query_service.py) is extended:

**New constructor params**: `rag_service: RAGService | None`, `shap_service: ShapExplainerService | None`

**New methods**:
- `_classify_intent(question) -> QueryIntent` — LLM-based classification (Section 6.3 prompt)
- `_execute_sql_query(question) -> dict` — Original Phase 1 logic (moved from execute_query)
- `_execute_document_query(question) -> dict` — Routes to RAG pipeline
- `_execute_explain_query(question) -> dict` — Routes to SHAP explainer
- `_execute_fused_query(question) -> dict` — Runs SQL + SHAP + RAG, synthesizes via LLM

**Modified `execute_query`**: Calls `_classify_intent()` first, then dispatches to the appropriate handler. Falls back to SQL if services are None (backward compatible).

---

### 4.7 Domain Layer Additions

#### [vector_store.py](file:///c:/ML%20Project/backend/src/domain/interfaces/vector_store.py) — VectorStore protocol
Methods: `upsert_chunks()`, `search()`, `delete_document()`, `health_check()`

#### [document_parser.py](file:///c:/ML%20Project/backend/src/domain/interfaces/document_parser.py) — DocumentParser protocol
Methods: `supports(filename) -> bool`, `parse(file_path) -> ParsedDocument`

#### [explainer_engine.py](file:///c:/ML%20Project/backend/src/domain/interfaces/explainer_engine.py) — ExplainerEngine protocol
Methods: `compute_explanation(model, forecast_df, target_date, ...) -> Any`

#### [vector_search_result.py](file:///c:/ML%20Project/backend/src/domain/value_objects/vector_search_result.py)
Frozen dataclass: `document_id`, `chunk_index`, `text_content`, `document_type`, `document_title`, `score`, `page_numbers`

#### [query_intent.py](file:///c:/ML%20Project/backend/src/domain/value_objects/query_intent.py)
Enum: `SQL`, `DOCUMENT`, `EXPLAIN`, `FUSED`

#### New exceptions in [exceptions.py](file:///c:/ML%20Project/backend/src/domain/exceptions.py):
- `DocumentParseError(CogniTwinError)` — Failed to parse document
- `VectorStoreError(CogniTwinError)` — Vector DB operation failed
- `DocumentNotFoundError(CogniTwinError)` — Document not found

---

## SECTION 5: REST API SPECIFICATION

### 5.1 `POST /api/v1/documents/upload`

**Purpose**: Upload a PDF document for RAG indexing.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | PDF file (max 100MB) |
| `document_type` | string | No | Override: `supplier_report`, `policy`, `market_analysis`, `invoice`, `general` |

**Response (201)**:
```json
{
  "status": "success",
  "data": {
    "document_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "supplier_q4_report.pdf",
    "document_type": "supplier_report",
    "page_count": 12,
    "chunk_count": 8,
    "status": "indexed"
  },
  "meta": { "processing_time_ms": 3450 }
}
```

**Errors**: 400 `DOCUMENT_PARSE_ERROR` (invalid file), 503 `VECTOR_STORE_ERROR` (Qdrant down)

---

### 5.2 `POST /api/v1/documents/search`

**Purpose**: Search indexed documents via semantic similarity.

**Request Body**:
```json
{
  "query": "supplier lead time issues for electronics",
  "top_k": 5,
  "document_type": "supplier_report"
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `query` | string | Yes | — |
| `top_k` | integer | No | 5 |
| `document_type` | string | No | null |

**Response (200)**:
```json
{
  "status": "success",
  "data": {
    "query": "supplier lead time issues",
    "results": [
      {
        "document_id": "uuid-1",
        "document_title": "supplier_q4_report",
        "document_type": "supplier_report",
        "chunk_index": 3,
        "text_content": "Lead times increased by 40% in Q4...",
        "relevance_score": 0.87,
        "page_numbers": [4, 5]
      }
    ],
    "total_results": 1
  }
}
```

---

### 5.3 `GET /api/v1/forecast/explain/{product_id}`

**Purpose**: Get SHAP-style explanation for a forecast.

**Path Parameters**: `product_id` (UUID or `"aggregate"`)

**Query Parameters**: `forecast_date` (YYYY-MM-DD, default: tomorrow)

**Response (200)**:
```json
{
  "status": "success",
  "data": {
    "product_id": null,
    "forecast_date": "2026-07-25",
    "predicted_value": 15200.00,
    "top_positive_drivers": [
      { "feature": "trend", "contribution": 0.2234, "description": "Long-term business trend" }
    ],
    "top_negative_drivers": [
      { "feature": "multiplicative_terms", "contribution": -0.0945, "description": "Scaling factors" }
    ],
    "explanation_text": "• 📈 Your business is growing...\n• 📈 Friday is a strong day...",
    "document_context": [
      { "document_title": "market_analysis_2024", "text_snippet": "...", "relevance_score": 0.65 }
    ]
  }
}
```

**Errors**: 409 `FORECAST_NOT_READY` (no model trained)

---

## SECTION 6: EXACT SYSTEM PROMPTS

### 6.1 Document-Grounded RAG Generation Prompt

```
You are a business intelligence assistant for CogniTwin AI. Answer the user's question using ONLY the retrieved document context below.

RETRIEVED DOCUMENT CONTEXT:
{doc_context}

USER QUESTION: {question}

RULES:
1. Cite source numbers [Source N] when referencing specific information.
2. If documents don't contain relevant information, state: "The uploaded documents don't contain information about this topic."
3. Keep answers under 300 words. Use bullet points for lists.
4. Highlight key findings in **bold**.
5. Do NOT fabricate information.
6. Do NOT mention "chunks", "embeddings", "vectors", or technical retrieval terms.
7. Speak as a business consultant.
8. Use ₹ with Indian numbering (₹4,52,000).

ANSWER:
```

### 6.2 SHAP Feature-Weight Natural Language Translation Prompt

```
You are a business analytics expert. Translate these forecast feature contributions into executive bullet points.

FORECAST DATE: {forecast_date}
PREDICTED VALUE: ₹{predicted_value}

FACTORS PUSHING SALES UP:
{positive_drivers}

FACTORS PUSHING SALES DOWN:
{negative_drivers}

RULES:
1. Write 3-5 bullet points maximum.
2. No technical jargon — no "seasonality coefficient", "trend component".
3. Translation examples:
   - "weekly +0.15" → "Sales tend to be higher on this day of the week."
   - "yearly -0.08" → "This time of year typically sees a seasonal dip."
   - "trend +0.22" → "Your overall business is on an upward trajectory."
4. Use ₹ with Indian numbering. Start bullets with emoji: 📈 (positive), 📉 (negative), ⚠️ (warning).
5. Be actionable — suggest what the owner should do.
6. Do NOT mention SHAP, Prophet, or ML terminology.

EXECUTIVE SUMMARY:
```

### 6.3 Query Intent Classification Prompt

```
Classify this business question into exactly ONE category:

- SQL: Sales data, revenue, products, customers, inventory numbers
- DOCUMENT: Uploaded documents, policies, supplier reports, contracts
- EXPLAIN: WHY a forecast predicts something, reasons behind predictions
- FUSED: Needs BOTH structured data AND document/explanation context

QUESTION: {question}

Return ONLY one word: SQL, DOCUMENT, EXPLAIN, or FUSED
```

---

## SECTION 7: STEP-BY-STEP AGENT EXECUTION PROMPTS

> [!IMPORTANT]
> Execute these 4 prompts **sequentially**. Each builds on the previous. Do NOT skip ahead.

### 🔧 Prompt 1: Document Infrastructure (PDF Parsing + Vector Store)

**Goal**: Build the infrastructure layer — PDFExtractor and QdrantVectorStore — without touching any Phase 1 services.

**Steps**:
1. Install dependencies: `pymupdf4llm`, `pymupdf`, `qdrant-client`, `fastembed`
2. Add QDRANT_HOST/PORT/COLLECTION to `config.py`
3. Create domain interfaces: `document_parser.py`, `vector_store.py`, `vector_search_result.py`
4. Add exceptions: `DocumentParseError`, `VectorStoreError`, `DocumentNotFoundError`
5. Create `infrastructure/document/pdf_extractor.py` and `infrastructure/vector/qdrant_store.py`
6. Create SQLite migration for `documents` table
7. Verify: Start Qdrant via Docker, test embed/search cycle

### 🔧 Prompt 2: RAG Service & Document API Endpoints

**Goal**: Wire the RAG pipeline and expose document upload/search via REST.

**Steps**:
1. Create `services/rag_service.py` (chunking, ingestion, search, RAG answer generation)
2. Create `api/schemas/document.py` (Pydantic models)
3. Create `api/document_router.py` (POST /documents/upload, POST /documents/search)
4. Wire in `dependencies.py`
5. Register router in `router.py`
6. Verify: Upload a PDF, search it, confirm chunks in Qdrant

### 🔧 Prompt 3: SHAP Explainability Engine

**Goal**: Add forecast explainability via Prophet decomposition.

**Steps**:
1. Create `domain/interfaces/explainer_engine.py`
2. Create `infrastructure/ml/shap_engine.py` (Prophet decomposition, NOT the `shap` library)
3. Create SQLite migration for `shap_cache` table
4. Create `services/shap_explainer_service.py` (compute → LLM translate → RAG fusion → cache)
5. Create `api/explain_router.py` (GET /forecast/explain/{product_id})
6. Wire in `dependencies.py`
7. Verify: Train model, call explain endpoint, verify cached results

### 🔧 Prompt 4: Query Router Enhancement + Frontend Integration

**Goal**: Make the Q&A chat intelligent — route queries to the right data source. Add frontend pages.

**Steps**:
1. Create `domain/value_objects/query_intent.py`
2. Modify `services/query_service.py`: add intent classification + routing (SQL/DOCUMENT/EXPLAIN/FUSED)
3. Update `dependencies.py` to inject RAG and SHAP services into QueryService
4. Create frontend pages: `/documents` (upload + search), SHAP panel on `/forecast`
5. Update `frontend/src/lib/api.ts` with new API methods
6. Update sidebar navigation
7. **Critical**: Run full regression test — all Phase 1 endpoints must still work

---

## APPENDIX A: Configuration Changes

```python
# Add to Settings class in config.py:
QDRANT_HOST: str = "localhost"
QDRANT_PORT: int = 6333
QDRANT_COLLECTION: str = "cognitwin_documents"
MAX_DOCUMENT_SIZE_MB: int = 100
CHUNK_SIZE_WORDS: int = 500
CHUNK_OVERLAP_WORDS: int = 50
SHAP_CACHE_TTL_HOURS: int = 24
```

## APPENDIX B: New Python Dependencies

```
pymupdf4llm>=0.0.17
pymupdf>=1.25.0
qdrant-client>=1.12.0
fastembed>=0.4.0
```

## APPENDIX C: Docker Compose Addition

```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
    - "6334:6334"
  volumes:
    - qdrant_data:/qdrant/storage
  restart: unless-stopped
```

## APPENDIX D: Health Check Update

Add `vector_store` component to `GET /api/v1/health` response.

## APPENDIX E: Migration Script

Alembic migration `phase2_001`: Creates `documents` and `shap_cache` tables with indexes.
