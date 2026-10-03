"""shap_cache: record the attribution method and the explained values

Revision ID: f1c8a3d92e57
Revises: e5b9f2a47c63
Create Date: 2026-10-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1c8a3d92e57'
down_revision: Union[str, Sequence[str], None] = 'e5b9f2a47c63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shap_cache', sa.Column('method', sa.String(length=50), nullable=True))
    op.add_column('shap_cache', sa.Column('method_note', sa.Text(), nullable=True))
    op.add_column('shap_cache', sa.Column('predicted_value', sa.Float(), nullable=True))
    op.add_column('shap_cache', sa.Column('base_value', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('shap_cache', 'base_value')
    op.drop_column('shap_cache', 'predicted_value')
    op.drop_column('shap_cache', 'method_note')
    op.drop_column('shap_cache', 'method')
