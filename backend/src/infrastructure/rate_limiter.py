"""In-process sliding-window rate limiter.

Deliberately dependency-free: tracks call timestamps per key in memory and
raises :class:`~src.domain.exceptions.RateLimitError` once the configured
window is exceeded. Suitable for a single-process deployment; for a horizontally
scaled API this would move to a shared store (e.g. Redis).
"""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict

from src.config import settings
from src.domain.exceptions import RateLimitError


class RateLimiter:
    """Sliding-window rate limiter keyed by an arbitrary string."""

    def __init__(self, max_calls: int, window_seconds: float):
        self._max_calls = max_calls
        self._window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        """Record a call for ``key`` and raise if the window quota is exhausted."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            cutoff = now - self._window_seconds
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self._max_calls:
                raise RateLimitError(
                    f"Rate limit exceeded: {self._max_calls} requests per "
                    f"{int(self._window_seconds)}s. Please retry shortly."
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


query_rate_limiter = RateLimiter(
    max_calls=settings.QUERY_RATE_LIMIT,
    window_seconds=60.0,
)
