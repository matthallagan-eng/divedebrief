"""note conditions: visibility and buddy on dive notes

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dive_notes", sa.Column("visibility_m", sa.Float(), nullable=True))
    op.add_column("dive_notes", sa.Column("buddy", sa.String(80), nullable=True))


def downgrade() -> None:
    op.drop_column("dive_notes", "buddy")
    op.drop_column("dive_notes", "visibility_m")
