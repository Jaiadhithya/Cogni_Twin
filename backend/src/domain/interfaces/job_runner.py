"""Background job runner protocol.

The in-process implementation lives in ``infrastructure/jobs``; a Celery/Redis
worker can replace it later without touching the services that submit work.
"""

from typing import Awaitable, Callable, Protocol


class JobRunner(Protocol):
    """Runs submitted work off the request path."""

    def submit(self, job_id: str, work: Callable[[], Awaitable[None]]) -> None:
        """Start ``work`` in the background, tracked under ``job_id``."""
        ...

    async def wait(self, job_id: str) -> bool:
        """Wait for a locally running job; False if this runner is not running it."""
        ...
