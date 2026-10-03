"""add training_jobs

Revision ID: d7a3c5e81f42
Revises: c41d7e9a2b10
Create Date: 2026-10-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7a3c5e81f42'
down_revision: Union[str, Sequence[str], None] = 'c41d7e9a2b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'training_jobs',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('dataset_id', sa.String(length=64), nullable=True),
        sa.Column('granularity', sa.String(length=20), nullable=False, server_default='daily'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='queued'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed')",
            name='ck_training_jobs_status',
        ),
    )
    op.create_index('ix_training_jobs_dataset_id', 'training_jobs', ['dataset_id'])
    op.create_index(
        'uq_training_jobs_active_dataset',
        'training_jobs',
        [sa.text("coalesce(dataset_id, '')")],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_index('uq_training_jobs_active_dataset', table_name='training_jobs')
    op.drop_index('ix_training_jobs_dataset_id', table_name='training_jobs')
    op.drop_table('training_jobs')
