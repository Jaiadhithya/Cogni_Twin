"""In-process TTL cache for /query results.

Keyed by ``(dataset_id, normalised question, schema version)``. The schema version
is bumped by ``invalidate`` (called on upload and undo through
``invalidate_table_schemas``), so stale answers can never outlive a data change.
The ``QueryCache`` interface is small on purpose: a Redis-backed implementation can
replace it without touching ``QueryService``.
"""

import copy
import re
import threading
import time
from typing import Any, Optional, Protocol

MAX_ENTRIES = 512


class QueryCache(Protocol):
    def get(self, dataset_id: Optional[str], question: str) -> Optional[dict[str, Any]]: ...
    def put(self, dataset_id: Optional[str], question: str, result: dict[str, Any], ttl: float) -> None: ...
    def invalidate(self) -> None: ...


def normalise_question(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower())


class InProcessQueryCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[tuple, tuple[float, dict[str, Any]]] = {}
        self._version = 0

    def _key(self, dataset_id: Optional[str], question: str) -> tuple:
        return (str(dataset_id) if dataset_id else None, normalise_question(question), self._version)

    def get(self, dataset_id: Optional[str], question: str) -> Optional[dict[str, Any]]:
        with self._lock:
            entry = self._entries.get(self._key(dataset_id, question))
            if entry is None or entry[0] < time.monotonic():
                return None
            return copy.deepcopy(entry[1])

    def put(self, dataset_id: Optional[str], question: str, result: dict[str, Any], ttl: float) -> None:
        if ttl <= 0:
            return
        with self._lock:
            now = time.monotonic()
            for k in [k for k, (exp, _) in self._entries.items() if exp < now]:
                del self._entries[k]
            while len(self._entries) >= MAX_ENTRIES:
                self._entries.pop(next(iter(self._entries)))
            self._entries[self._key(dataset_id, question)] = (now + ttl, copy.deepcopy(result))

    def invalidate(self) -> None:
        with self._lock:
            self._version += 1
            self._entries.clear()


query_cache: QueryCache = InProcessQueryCache()
