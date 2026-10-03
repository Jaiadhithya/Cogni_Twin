"""Background training jobs: submit, run, report, and recover after a restart."""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.exceptions import MlError, NotFoundError
from src.domain.interfaces.job_runner import JobRunner
from src.infrastructure.database.models import TrainingJobModel
from src.infrastructure.metrics import TRAINING_DURATION, TRAINING_QUEUE_DEPTH

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = ("queued", "running")
RESTART_ERROR = "Interrupted by a server restart before the job finished."
UNEXPECTED_ERROR = "Training failed unexpectedly. See server logs for details."


class TrainingJobNotFoundError(NotFoundError):
    """Unknown training job id."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _dataset_key(dataset_id: Optional[str]) -> Optional[str]:
    return str(dataset_id) if dataset_id else None


def job_to_dict(job: TrainingJobModel) -> dict[str, Any]:
    def iso(value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None

    return {
        "job_id": str(job.id),
        "dataset_id": job.dataset_id,
        "granularity": job.granularity,
        "status": job.status,
        "error": job.error,
        "created_at": iso(job.created_at),
        "started_at": iso(job.started_at),
        "finished_at": iso(job.finished_at),
        "metrics": job.metrics,
    }


class TrainingJobService:
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        runner: JobRunner,
        train: Callable[[str, Optional[str]], Awaitable[dict[str, Any]]],
    ):
        """``train(granularity, dataset_id)`` does the actual work and returns its metrics."""
        self._session_factory = session_factory
        self._runner = runner
        self._train = train
        self._submit_lock = asyncio.Lock()

    async def submit(self, dataset_id: Optional[str], granularity: str) -> tuple[dict[str, Any], bool]:
        """Queue a training job. Returns ``(job, created)``; an active job for the dataset is reused."""
        key = _dataset_key(dataset_id)
        async with self._submit_lock:
            async with self._session_factory() as session:
                existing = await self._active_job(session, key)
                if existing is not None:
                    return job_to_dict(existing), False
                job = TrainingJobModel(id=uuid.uuid4(), dataset_id=key, granularity=granularity, status="queued")
                session.add(job)
                try:
                    await session.commit()
                except IntegrityError:
                    # Another worker queued one between our check and insert.
                    await session.rollback()
                    existing = await self._active_job(session, key)
                    if existing is None:
                        raise
                    return job_to_dict(existing), False
                await session.refresh(job)
                job_id = str(job.id)
                result = job_to_dict(job)

            TRAINING_QUEUE_DEPTH.inc()
            self._runner.submit(job_id, lambda: self._run(job_id, key, granularity))
            return result, True

    async def get(self, job_id: str) -> dict[str, Any]:
        try:
            parsed = uuid.UUID(str(job_id))
        except ValueError:
            raise TrainingJobNotFoundError(f"Training job '{job_id}' not found.")
        async with self._session_factory() as session:
            job = await session.get(TrainingJobModel, parsed)
            if job is None:
                raise TrainingJobNotFoundError(f"Training job '{job_id}' not found.")
            return job_to_dict(job)

    async def wait(self, job_id: str, timeout: float = 900.0, poll_seconds: float = 0.5) -> dict[str, Any]:
        """Block until the job is finished (awaiting the local task, else polling the table)."""
        deadline = time.monotonic() + timeout
        await self._runner.wait(job_id)
        while True:
            job = await self.get(job_id)
            if job["status"] not in ACTIVE_STATUSES or time.monotonic() >= deadline:
                return job
            await asyncio.sleep(poll_seconds)

    async def mark_stale_jobs_failed(self) -> int:
        """Fail every job left queued/running by a previous process."""
        async with self._session_factory() as session:
            result = await session.execute(
                update(TrainingJobModel)
                .where(TrainingJobModel.status.in_(ACTIVE_STATUSES))
                .values(status="failed", error=RESTART_ERROR, finished_at=_now())
            )
            await session.commit()
            count = result.rowcount or 0
        if count:
            logger.warning(f"Marked {count} stale training job(s) as failed after restart")
        return count

    async def _active_job(self, session: AsyncSession, key: Optional[str]) -> Optional[TrainingJobModel]:
        query = select(TrainingJobModel).where(TrainingJobModel.status.in_(ACTIVE_STATUSES))
        query = query.where(TrainingJobModel.dataset_id.is_(None) if key is None else TrainingJobModel.dataset_id == key)
        return (await session.execute(query.limit(1))).scalar_one_or_none()

    async def _finish(self, job_id: str, **values: Any) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(TrainingJobModel).where(TrainingJobModel.id == uuid.UUID(job_id)).values(finished_at=_now(), **values)
            )
            await session.commit()

    async def _run(self, job_id: str, dataset_id: Optional[str], granularity: str) -> None:
        started = time.monotonic()
        outcome = "failed"
        try:
            async with self._session_factory() as session:
                await session.execute(
                    update(TrainingJobModel)
                    .where(TrainingJobModel.id == uuid.UUID(job_id))
                    .values(status="running", started_at=_now())
                )
                await session.commit()

            metrics = await self._train(granularity, dataset_id)
            metrics = {**metrics, "duration_seconds": round(time.monotonic() - started, 2)}
            await self._finish(job_id, status="succeeded", metrics=metrics)
            outcome = "succeeded"
        except MlError as e:
            await self._finish(job_id, status="failed", error=str(e))
        except Exception:
            logger.exception(f"Training job {job_id} failed")
            try:
                await self._finish(job_id, status="failed", error=UNEXPECTED_ERROR)
            except Exception:
                logger.exception(f"Could not record failure of training job {job_id}")
        finally:
            TRAINING_QUEUE_DEPTH.dec()
            TRAINING_DURATION.labels(outcome).observe(time.monotonic() - started)
