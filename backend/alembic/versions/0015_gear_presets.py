"""gear presets: named kits the diver wears often

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gear_presets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("suit", sa.String(16), nullable=True),
        sa.Column("tank_material", sa.String(16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name"),
    )
    op.create_index("ix_gear_presets_user_id", "gear_presets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_gear_presets_user_id", table_name="gear_presets")
    op.drop_table("gear_presets")
