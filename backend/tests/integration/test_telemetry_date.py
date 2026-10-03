"""daily_business_telemetry.date is a real DATE column."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.infrastructure.database.models import DailyBusinessTelemetryModel

SENTINEL = date(1999, 12, 31)


@pytest.mark.asyncio
async def test_date_round_trips_as_date(test_engine):
    sessions = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as session:
        await session.execute(delete(DailyBusinessTelemetryModel).where(DailyBusinessTelemetryModel.date == SENTINEL))
        session.add(
            DailyBusinessTelemetryModel(
                date=SENTINEL,
                sales_volume=Decimal("10"),
                unit_price=Decimal("2.5"),
                marketing_spend=Decimal("1"),
                supplier_lead_time_days=Decimal("3"),
                competitor_discount_pct=Decimal("0"),
                revenue=Decimal("25"),
            )
        )
        await session.commit()
        try:
            row = (await session.execute(select(DailyBusinessTelemetryModel).where(DailyBusinessTelemetryModel.date == SENTINEL))).scalar_one()
            assert row.date == SENTINEL and isinstance(row.date, date)
            col_type = (await session.execute(text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'daily_business_telemetry' AND column_name = 'date'"
            ))).scalar_one()
            assert col_type == "date"
        finally:
            await session.execute(delete(DailyBusinessTelemetryModel).where(DailyBusinessTelemetryModel.date == SENTINEL))
            await session.commit()
