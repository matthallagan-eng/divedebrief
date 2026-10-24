"""dive_tanks: tank size and pressures for air efficiency

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dive_tanks",
        sa.Column(
            "dive_id",
            sa.Integer(),
            sa.ForeignKey("dives.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("volume_l", sa.Float(), nullable=True),
        sa.Column("start_bar", sa.Float(), nullable=False),
        sa.Column("end_bar", sa.Float(), nullable=False),
        sa.Column("source", sa.String(8), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dive_tanks")
