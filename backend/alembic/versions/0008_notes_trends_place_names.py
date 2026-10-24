"""dive notes, ascent metrics for trends, and site name suggestions

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-24

The scoring algorithm version goes up with this change, so every dive is
rescored, and gets its ascent metrics, the next time it's read.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dive_scores", sa.Column("metrics", JSONB(), nullable=False, server_default="{}")
    )
    op.add_column("sites", sa.Column("name_suggestions", JSONB(), nullable=True))
    op.create_table(
        "dive_notes",
        sa.Column(
            "dive_id",
            sa.Integer(),
            sa.ForeignKey("dives.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("feeling", sa.Integer(), nullable=True),
        sa.Column("sea_life", JSONB(), nullable=False),
        sa.Column("landmarks", JSONB(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("dive_notes")
    op.drop_column("sites", "name_suggestions")
    op.drop_column("dive_scores", "metrics")
