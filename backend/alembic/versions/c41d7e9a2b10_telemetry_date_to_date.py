"""daily_business_telemetry.date: String(50) -> Date

Revision ID: c41d7e9a2b10
Revises: a13aa534bec5
Create Date: 2026-10-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'c41d7e9a2b10'
down_revision: Union[str, Sequence[str], None] = 'a13aa534bec5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ISO_DATE = r'^\d{4}-\d{2}-\d{2}'


def upgrade() -> None:
    """Convert the key column to a real date; refuse to run rather than drop bad rows."""
    # Offline (--sql) mode has no connection to inspect rows; the USING cast below still
    # fails the generated script on a bad value, so nothing is silently dropped.
    bad = []
    if not context.is_offline_mode():
        bad = op.get_bind().execute(
            sa.text(
                "SELECT date FROM daily_business_telemetry WHERE date !~ :pattern LIMIT 5"
            ),
            {"pattern": _ISO_DATE},
        ).scalars().all()
    if bad:
        raise RuntimeError(
            "Cannot convert daily_business_telemetry.date to DATE: "
            f"non-ISO values found (e.g. {bad}). Fix or remove those rows and re-run."
        )
    try:
        op.alter_column(
            'daily_business_telemetry',
            'date',
            existing_type=sa.String(length=50),
            type_=sa.Date(),
            existing_nullable=False,
            postgresql_using='date::date',
        )
    except sa.exc.DataError as exc:
        raise RuntimeError(
            "Cannot convert daily_business_telemetry.date to DATE: "
            f"a value is not a valid calendar date ({exc.orig})."
        ) from exc


def downgrade() -> None:
    op.alter_column(
        'daily_business_telemetry',
        'date',
        existing_type=sa.Date(),
        type_=sa.String(length=50),
        existing_nullable=False,
        postgresql_using="to_char(date, 'YYYY-MM-DD')",
    )
