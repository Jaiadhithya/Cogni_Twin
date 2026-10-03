"""add simulation_runs

Revision ID: e5b9f2a47c63
Revises: d7a3c5e81f42
Create Date: 2026-10-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5b9f2a47c63'
down_revision: Union[str, Sequence[str], None] = 'd7a3c5e81f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'simulation_runs',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('dataset_id', sa.String(length=64), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('mutations', sa.JSON(), nullable=False),
        sa.Column('horizon_days', sa.Integer(), nullable=False),
        sa.Column('baseline_summary', sa.JSON(), nullable=False),
        sa.Column('simulated_summary', sa.JSON(), nullable=False),
        sa.Column('delta_metrics', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_simulation_runs_dataset_id', 'simulation_runs', ['dataset_id'])
    op.create_index('ix_simulation_runs_created_at', 'simulation_runs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_simulation_runs_created_at', table_name='simulation_runs')
    op.drop_index('ix_simulation_runs_dataset_id', table_name='simulation_runs')
    op.drop_table('simulation_runs')
