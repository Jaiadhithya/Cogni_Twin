"""A UoW shared across services must close every session it opens."""

import pytest

from src.infrastructure.database.uow import SqlAlchemyUnitOfWork


class FakeSession:
    def __init__(self) -> None:
        self.closed = False
        self.committed = False
        self.rolled_back = False

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True

    async def close(self) -> None:
        self.closed = True


def make_uow() -> tuple[SqlAlchemyUnitOfWork, list[FakeSession]]:
    sessions: list[FakeSession] = []

    def factory() -> FakeSession:
        sessions.append(FakeSession())
        return sessions[-1]

    return SqlAlchemyUnitOfWork(factory, readonly_session_factory=lambda: None), sessions


@pytest.mark.asyncio
async def test_nested_entry_closes_outer_and_inner_sessions():
    uow, sessions = make_uow()

    async with uow:
        outer = uow._session
        async with uow:
            assert uow._session is not outer
        # Inner exit hands the outer session back to its owner.
        assert uow._session is outer
        assert not outer.closed

    assert len(sessions) == 2
    assert all(s.closed for s in sessions), "an orphaned session would stay idle in transaction"
    assert all(s.committed for s in sessions)


@pytest.mark.asyncio
async def test_exception_in_inner_block_rolls_back_inner_and_still_closes_outer():
    uow, sessions = make_uow()

    async with uow:
        with pytest.raises(ValueError):
            async with uow:
                raise ValueError("boom")

    inner, outer = sessions[1], sessions[0]
    assert inner.rolled_back and inner.closed
    assert outer.committed and outer.closed
