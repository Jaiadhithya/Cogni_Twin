"""Shared test helpers: synthetic sales data and an in-memory vector store."""

import math
import random
import re
from datetime import date, timedelta
from typing import Any, Dict, List

from src.domain.interfaces.vector_store import VectorStore
from src.domain.value_objects.vector_search_result import VectorSearchResult

# Comfortably above FORECAST_MIN_DATA_POINTS so training never trips the guard.
DEFAULT_DAYS = 90


def make_sales_csv(days: int = DEFAULT_DAYS, start: date = date(2024, 1, 1), seed: int = 7) -> tuple[str, date]:
    """Build a daily sales CSV carrying every lever the forecaster knows about.

    Returns ``(csv_text, last_date)``. Demand has a weekly pattern and responds to
    price and marketing so Prophet has real signal to fit.
    """
    rng = random.Random(seed)
    rows = ["date,product_id,units_sold,unit_price,marketing_spend,supplier_lead_time_days,competitor_discount_pct"]
    for i in range(days):
        day = start + timedelta(days=i)
        unit_price = round(10.0 - 0.5 * (i % 5) + rng.uniform(-0.2, 0.2), 2)
        marketing = round(500 + 40 * (i % 7) + rng.uniform(-30, 30), 2)
        lead_time = 5 + (i % 4)
        competitor = round(rng.uniform(0, 10), 1)
        weekly = 15 * math.sin(2 * math.pi * (i % 7) / 7)
        units = round(100 + weekly + 0.05 * marketing - 2 * unit_price + rng.uniform(-5, 5))
        rows.append(f"{day.isoformat()},P001,{units},{unit_price},{marketing},{lead_time},{competitor}")
    return "\n".join(rows) + "\n", start + timedelta(days=days - 1)


_TOKEN = re.compile(r"[a-z0-9]+")


class InMemoryVectorStore(VectorStore):
    """Lexical stand-in for Qdrant so tests run without a vector server.

    Scores by query-term overlap; chunks sharing no term with the query are not
    returned, which mirrors "no relevant match" closely enough for API contract tests.
    """

    def __init__(self) -> None:
        self._chunks: List[Dict[str, Any]] = []

    @staticmethod
    def _terms(text: str) -> set[str]:
        return set(_TOKEN.findall(text.lower()))

    def upsert_vectors(self, document_id: str, chunks: List[Dict[str, Any]]) -> None:
        self._chunks = [c for c in self._chunks if c["document_id"] != document_id]
        for i, chunk in enumerate(chunks):
            self._chunks.append(
                {
                    "document_id": document_id,
                    "chunk_id": str(chunk.get("chunk_id") or i),
                    "text": chunk.get("text", ""),
                    "metadata": dict(chunk.get("metadata", {})),
                }
            )

    def search_vectors(self, query_text: str, top_k: int = 5) -> List[VectorSearchResult]:
        query_terms = self._terms(query_text)
        scored = []
        for chunk in self._chunks:
            overlap = len(query_terms & self._terms(chunk["text"]))
            if overlap:
                scored.append((overlap / len(query_terms), chunk))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [
            VectorSearchResult(
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                score=score,
                text=chunk["text"],
                metadata={**chunk["metadata"], "document_id": chunk["document_id"], "text": chunk["text"]},
            )
            for score, chunk in scored[:top_k]
        ]

    def delete_vectors(self, document_id: str) -> None:
        self._chunks = [c for c in self._chunks if c["document_id"] != document_id]
