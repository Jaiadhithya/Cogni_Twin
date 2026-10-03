"""Background training jobs: lifecycle, de-duplication, failure and restart recovery."""

import asyncio
import uuid

import httpx
import pytest
from sqlalchemy import delete, select

from src.infrastructure.database.models import TrainingJobModel
from src.infrastructure.database.session import AsyncSessionLocal
from src.infrastructure.jobs.asyncio_runner import AsyncioJobRunner
from src.domain.exceptions import MlError
from src.main import app
from src.services.training_job_service import RESTART_ERROR, TrainingJobNotFoundError, TrainingJobService


@pytest.fixture
async def cleanup():
    dataset_ids: list[str] = []
    yield dataset_ids
    async with AsyncSessionLocal() as session:
        await session.execute(delete(TrainingJobModel).where(TrainingJobModel.dataset_id.in_(dataset_ids)))
        await session.commit()


def _service(train) -> TrainingJobService:
    return TrainingJobService(AsyncSessionLocal, AsyncioJobRunner(), train)


@pytest.mark.asyncio
async def test_job_lifecycle_success(cleanup):
    ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(ds)
    release = asyncio.Event()

    async def train(granularity, dataset_id):
        await release.wait()
        return {"training_id": "m-1", "granularity": granularity}

    service = _service(train)
    job, created = await service.submit(ds, "weekly")
    assert created and job["status"] == "queued"

    release.set()
    done = await service.wait(job["job_id"])
    assert done["status"] == "succeeded"
    assert done["metrics"]["training_id"] == "m-1" and "duration_seconds" in done["metrics"]
    assert done["started_at"] and done["finished_at"] and done["error"] is None


@pytest.mark.asyncio
async def test_wait_times_out_without_cancelling_the_job(cleanup):
    ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(ds)
    release = asyncio.Event()

    async def train(granularity, dataset_id):
        await release.wait()
        return {}

    service = _service(train)
    job, _ = await service.submit(ds, "daily")

    timed_out = await service.wait(job["job_id"], timeout=0.2)
    assert timed_out["status"] in ("queued", "running")

    release.set()
    done = await service.wait(job["job_id"])
    assert done["status"] == "succeeded"


@pytest.mark.asyncio
async def test_concurrent_submit_for_same_dataset_returns_existing_job(cleanup):
    ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(ds)
    release = asyncio.Event()

    async def train(granularity, dataset_id):
        await release.wait()
        return {}

    service = _service(train)
    first, created_first = await service.submit(ds, "daily")
    second, created_second = await service.submit(ds, "daily")
    assert created_first and not created_second
    assert second["job_id"] == first["job_id"]

    # a different dataset is not blocked
    other_ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(other_ds)
    other, created_other = await service.submit(other_ds, "daily")
    assert created_other and other["job_id"] != first["job_id"]

    release.set()
    await service.wait(first["job_id"])
    await service.wait(other["job_id"])
    # once finished, a new job may start
    third, created_third = await service.submit(ds, "daily")
    assert created_third and third["job_id"] != first["job_id"]
    await service.wait(third["job_id"])


@pytest.mark.asyncio
async def test_failed_training_records_error(cleanup):
    ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(ds)

    async def train(granularity, dataset_id):
        raise MlError("not enough data")

    service = _service(train)
    job, _ = await service.submit(ds, "daily")
    done = await service.wait(job["job_id"])
    assert done["status"] == "failed" and done["error"] == "not enough data"


@pytest.mark.asyncio
async def test_unexpected_error_is_not_leaked(cleanup):
    ds = f"pytest-{uuid.uuid4()}"
    cleanup.append(ds)

    async def train(granularity, dataset_id):
        raise RuntimeError("postgresql://user:secret@host/db exploded")

    service = _service(train)
    job, _ = await service.submit(ds, "daily")
    done = await service.wait(job["job_id"])
    assert done["status"] == "failed" and "secret" not in done["error"]


@pytest.mark.asyncio
async def test_stale_active_jobs_are_failed_on_startup(cleanup):
    running_ds, queued_ds = f"pytest-{uuid.uuid4()}", f"pytest-{uuid.uuid4()}"
    cleanup.extend([running_ds, queued_ds])
    ids = {}
    async with AsyncSessionLocal() as session:
        for ds, status in ((running_ds, "running"), (queued_ds, "queued")):
            job = TrainingJobModel(id=uuid.uuid4(), dataset_id=ds, granularity="daily", status=status)
            session.add(job)
            ids[ds] = job.id
        await session.commit()

    service = _service(lambda g, d: asyncio.sleep(0))
    assert await service.mark_stale_jobs_failed() >= 2

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(TrainingJobModel).where(TrainingJobModel.id.in_(ids.values())))).scalars().all()
    assert {r.status for r in rows} == {"failed"}
    assert all(r.error == RESTART_ERROR and r.finished_at for r in rows)


@pytest.mark.asyncio
async def test_unknown_job_is_not_found():
    service = _service(lambda g, d: asyncio.sleep(0))
    with pytest.raises(TrainingJobNotFoundError):
        await service.get(str(uuid.uuid4()))
    with pytest.raises(TrainingJobNotFoundError):
        await service.get("not-a-uuid")


@pytest.mark.asyncio
async def test_api_returns_202_then_job_succeeds(dataset_factory):
    ds = dataset_factory(days=40, filename="pytest_jobs.csv")["dataset_id"]
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        res = await ac.post("/api/v1/forecast/train", json={"granularity": "daily", "dataset_id": ds})
        assert res.status_code == 202, res.text
        job = res.json()["data"]
        assert job["status"] in ("queued", "running") and job["dataset_id"] == ds

        for _ in range(240):
            polled = (await ac.get(f"/api/v1/forecast/jobs/{job['job_id']}")).json()["data"]
            if polled["status"] in ("succeeded", "failed"):
                break
            await asyncio.sleep(0.5)
        assert polled["status"] == "succeeded", polled
        assert polled["metrics"]["training_id"]

        missing = await ac.get(f"/api/v1/forecast/jobs/{uuid.uuid4()}")
        assert missing.status_code == 404


@pytest.mark.asyncio
async def test_api_wait_true_surfaces_training_failure():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        res = await ac.post(
            "/api/v1/forecast/train?wait=true",
            json={"granularity": "daily", "dataset_id": str(uuid.uuid4())},
        )
    assert res.status_code == 400
    assert res.json()["error"]["type"] == "ML_ERROR"
    async with AsyncSessionLocal() as session:
        await session.execute(delete(TrainingJobModel).where(TrainingJobModel.status == "failed", TrainingJobModel.error.like("No dataset%")))
        await session.commit()
