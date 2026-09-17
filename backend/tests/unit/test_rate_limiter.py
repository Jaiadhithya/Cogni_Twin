"""Unit tests for the in-process rate limiter."""

import pytest

from src.infrastructure.rate_limiter import RateLimiter
from src.domain.exceptions import RateLimitError


def test_allows_calls_under_limit():
    limiter = RateLimiter(max_calls=3, window_seconds=60.0)
    limiter.check("k")
    limiter.check("k")
    limiter.check("k")


def test_blocks_calls_over_limit():
    limiter = RateLimiter(max_calls=2, window_seconds=60.0)
    limiter.check("k")
    limiter.check("k")
    with pytest.raises(RateLimitError):
        limiter.check("k")


def test_keys_are_isolated():
    limiter = RateLimiter(max_calls=1, window_seconds=60.0)
    limiter.check("a")
    limiter.check("b")


def test_window_evicts_stale_entries():
    limiter = RateLimiter(max_calls=1, window_seconds=0.05)
    limiter.check("k")
    import time

    time.sleep(0.06)
    limiter.check("k")


def test_reset_clears_state():
    limiter = RateLimiter(max_calls=1, window_seconds=60.0)
    limiter.check("k")
    limiter.reset()
    limiter.check("k")
