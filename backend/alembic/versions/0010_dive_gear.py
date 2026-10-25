"""dive_gear: weights, exposure suit and tank material per dive, compared
with buoyancy in the debrief

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-24

The scoring algorithm version goes up with this change (new stop and
buoyancy metrics for the debrief), so every dive is rescored when next read.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dive_gear",
        sa.Column(
            "dive_id",
            sa.Integer(),
            sa.ForeignKey("dives.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("suit", sa.String(16), nullable=True),
        sa.Column("tank_material", sa.String(16), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dive_gear")
