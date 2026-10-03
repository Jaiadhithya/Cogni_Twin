"""Prometheus metrics and the helpers that feed them."""

import functools
import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

HTTP_REQUESTS = Counter("http_requests_total", "HTTP requests", ["method", "route", "status"])
HTTP_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "route"])
LLM_CALLS = Counter("llm_calls_total", "LLM calls", ["operation", "outcome"])
LLM_LATENCY = Histogram("llm_call_duration_seconds", "LLM call latency", ["operation"])
LLM_FALLBACKS = Counter("llm_fallbacks_total", "Times a deterministic fallback replaced an LLM answer", ["operation"])
TRAINING_DURATION = Histogram("training_duration_seconds", "Model training duration", ["outcome"])
TRAINING_QUEUE_DEPTH = Gauge("training_jobs_active", "Training jobs queued or running in this process")


def render() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


def record_fallback(operation: str) -> None:
    LLM_FALLBACKS.labels(operation).inc()


def track_llm(operation: str):
    """Decorator for async LLM client methods: call count by outcome and latency."""

    def wrap(fn):
        @functools.wraps(fn)
        async def inner(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = await fn(*args, **kwargs)
            except Exception:
                LLM_CALLS.labels(operation, "error").inc()
                raise
            else:
                LLM_CALLS.labels(operation, "ok").inc()
                return result
            finally:
                LLM_LATENCY.labels(operation).observe(time.perf_counter() - start)

        return inner

    return wrap
