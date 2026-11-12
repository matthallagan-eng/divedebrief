"""dive photos: photos from a dive, stored as files

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dive_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dive_id", sa.Integer(), sa.ForeignKey("dives.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file", sa.String(80), nullable=False),
        sa.Column("caption", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dive_photos_dive_id", "dive_photos", ["dive_id"])


def downgrade() -> None:
    op.drop_index("ix_dive_photos_dive_id", table_name="dive_photos")
    op.drop_table("dive_photos")
