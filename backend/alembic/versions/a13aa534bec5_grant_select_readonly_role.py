"""grant_select_readonly_role

Revision ID: a13aa534bec5
Revises: 59156b6e1509
Create Date: 2026-09-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a13aa534bec5'
down_revision: Union[str, Sequence[str], None] = '59156b6e1509'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Grant SELECT to the read-only role used for LLM query execution."""
    op.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO cognitwin_readonly")
    op.execute("GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO cognitwin_readonly")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT ON TABLES TO cognitwin_readonly"
    )


def downgrade() -> None:
    """Revoke SELECT from the read-only role."""
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "REVOKE SELECT ON TABLES FROM cognitwin_readonly"
    )
    op.execute("REVOKE SELECT ON ALL SEQUENCES IN SCHEMA public FROM cognitwin_readonly")
    op.execute("REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM cognitwin_readonly")
