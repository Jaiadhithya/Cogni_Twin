"""Process-local cache of per-dataset analysis results (profile, correlations, scatter).

Entries are keyed ``(dataset_id, kind, *params)``. Anything that changes a dataset's
rows (upload, undo) clears its entries via ``clear``; ``invalidate_table_schemas``
calls it, so the existing invalidation points cover this cache too.
"""

import threading
from collections import OrderedDict
from typing import Any

_MAX_ENTRIES = 256
_lock = threading.Lock()
_entries: "OrderedDict[tuple, Any]" = OrderedDict()


def get(key: tuple) -> Any | None:
    with _lock:
        value = _entries.get(key)
        if value is not None:
            _entries.move_to_end(key)
        return value


def put(key: tuple, value: Any) -> None:
    with _lock:
        _entries[key] = value
        _entries.move_to_end(key)
        while len(_entries) > _MAX_ENTRIES:
            _entries.popitem(last=False)


def clear(dataset_id: str | None = None) -> None:
    """Drop one dataset's entries, or everything when ``dataset_id`` is None."""
    with _lock:
        if dataset_id is None:
            _entries.clear()
            return
        wanted = str(dataset_id)
        for key in [k for k in _entries if k[0] == wanted]:
            del _entries[key]
