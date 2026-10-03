"""In-process job runner backed by asyncio tasks."""

import asyncio
import logging
from typing import Awaitable, Callable

from src.domain.interfaces.job_runner import JobRunner

logger = logging.getLogger(__name__)


class AsyncioJobRunner(JobRunner):
    def __init__(self) -> None:
        # Strong references: a bare create_task() result can be garbage-collected mid-run.
        self._tasks: dict[str, asyncio.Task] = {}

    def submit(self, job_id: str, work: Callable[[], Awaitable[None]]) -> None:
        task = asyncio.create_task(work(), name=f"job-{job_id}")
        self._tasks[job_id] = task
        task.add_done_callback(lambda _t, jid=job_id: self._tasks.pop(jid, None))

    async def wait(self, job_id: str) -> bool:
        task = self._tasks.get(job_id)
        if task is None:
            return False
        try:
            await asyncio.shield(task)
        except Exception:
            pass  # the job records its own failure; waiting never re-raises it
        return True


_runner = AsyncioJobRunner()


def get_job_runner() -> JobRunner:
    return _runner
