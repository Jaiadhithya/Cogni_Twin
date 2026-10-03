"""Saved what-if scenarios: persist, list and compare."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import func, select

from src.domain.exceptions import NotFoundError, ValidationError
from src.domain.interfaces.uow import UnitOfWork
from src.infrastructure.database.models import SimulationRunModel

MIN_COMPARE = 2
MAX_COMPARE = 10

# Metrics shown side by side in a comparison: (section, key).
_COMPARE_METRICS = (
    ("baseline_summary", "total"),
    ("baseline_summary", "daily_average"),
    ("simulated_summary", "total"),
    ("simulated_summary", "daily_average"),
    ("delta_metrics", "total_delta"),
    ("delta_metrics", "total_delta_pct"),
)


class SimulationRunNotFoundError(NotFoundError):
    """Unknown saved simulation."""


def summaries_from_result(result: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Reduce a simulation response to the three JSON blobs stored with a run."""
    horizon = len(result.get("points") or []) or 1
    baseline, simulated = result["baseline_total"], result["mutated_total"]
    return {
        "baseline_summary": {"total": baseline, "daily_average": round(baseline / horizon, 2)},
        "simulated_summary": {"total": simulated, "daily_average": round(simulated / horizon, 2)},
        "delta_metrics": {"total_delta": result["total_delta"], "total_delta_pct": result["total_delta_pct"]},
    }


def run_to_dict(run: SimulationRunModel) -> dict[str, Any]:
    def iso(value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None

    return {
        "id": str(run.id),
        "dataset_id": run.dataset_id,
        "name": run.name,
        "mutations": run.mutations,
        "horizon_days": run.horizon_days,
        "baseline_summary": run.baseline_summary,
        "simulated_summary": run.simulated_summary,
        "delta_metrics": run.delta_metrics,
        "created_at": iso(run.created_at),
    }


class SimulationRunService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def save(
        self,
        result: dict[str, Any],
        mutations: dict[str, Any],
        horizon_days: int,
        dataset_id: Optional[str],
        name: Optional[str],
    ) -> dict[str, Any]:
        run = SimulationRunModel(
            id=uuid.uuid4(),
            dataset_id=str(dataset_id) if dataset_id else None,
            name=name.strip() if name and name.strip() else None,
            mutations=mutations,
            horizon_days=horizon_days,
            **summaries_from_result(result),
        )
        async with self.uow as uow:
            uow.repository.session.add(run)
            await uow.commit()
            await uow.repository.session.refresh(run)
            return run_to_dict(run)

    async def list_runs(self, dataset_id: Optional[str], page: int, page_size: int) -> tuple[list[dict[str, Any]], int]:
        filters = [SimulationRunModel.dataset_id == str(dataset_id)] if dataset_id else []
        async with self.uow as uow:
            session = uow.repository.session
            total = (await session.execute(select(func.count()).select_from(SimulationRunModel).where(*filters))).scalar_one()
            rows = (
                await session.execute(
                    select(SimulationRunModel)
                    .where(*filters)
                    .order_by(SimulationRunModel.created_at.desc(), SimulationRunModel.id)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [run_to_dict(r) for r in rows], total

    async def compare(self, ids: list[str]) -> dict[str, Any]:
        unique_ids = list(dict.fromkeys(ids))
        if not MIN_COMPARE <= len(unique_ids) <= MAX_COMPARE:
            raise ValidationError(f"Provide between {MIN_COMPARE} and {MAX_COMPARE} distinct simulation ids to compare.")
        try:
            parsed = [uuid.UUID(i) for i in unique_ids]
        except ValueError:
            raise ValidationError("Simulation ids must be UUIDs.")

        async with self.uow as uow:
            rows = (
                await uow.repository.session.execute(select(SimulationRunModel).where(SimulationRunModel.id.in_(parsed)))
            ).scalars().all()
            by_id = {str(r.id): run_to_dict(r) for r in rows}

        missing = [i for i in unique_ids if str(uuid.UUID(i)) not in by_id]
        if missing:
            raise SimulationRunNotFoundError(f"Simulation(s) not found: {', '.join(missing)}")

        ordered = [by_id[str(p)] for p in parsed]
        if len({r["dataset_id"] for r in ordered}) > 1:
            raise ValidationError("Simulations from different datasets cannot be compared.")

        metrics = [
            {
                "metric": f"{section.split('_')[0]}_{key}" if section != "delta_metrics" else key,
                "values": [r[section].get(key) for r in ordered],
            }
            for section, key in _COMPARE_METRICS
        ]
        return {
            "run_ids": [r["id"] for r in ordered],
            "runs": [
                {k: r[k] for k in ("id", "name", "dataset_id", "mutations", "horizon_days", "created_at")}
                for r in ordered
            ],
            "metrics": metrics,
        }
