"""skill scores and per-diver scoring settings

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.create_table(
        "dive_scores",
        sa.Column(
            "dive_id",
            sa.Integer(),
            sa.ForeignKey("dives.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("skill", sa.String(32), primary_key=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("regions", postgresql.JSONB(), nullable=False),
        sa.Column("algorithm_version", sa.Integer(), nullable=False),
        sa.Column("settings_version", sa.Integer(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Replaced by the ascent control score
    op.drop_column("dives", "ascent_violations")


def downgrade() -> None:
    op.add_column(
        "dives",
        sa.Column("ascent_violations", sa.Integer(), nullable=False, server_default="0"),
    )
    op.drop_table("dive_scores")
    op.drop_table("user_settings")
