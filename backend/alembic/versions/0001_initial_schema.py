"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dives_added", sa.Integer(), nullable=False),
        sa.Column("dives_skipped", sa.Integer(), nullable=False),
    )
    op.create_index("ix_uploads_sha256", "uploads", ["sha256"])

    op.create_table(
        "dives",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "upload_id",
            sa.Integer(),
            sa.ForeignKey("uploads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fingerprint", sa.String(64), nullable=False, unique=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_s", sa.Float(), nullable=False),
        sa.Column("max_depth_m", sa.Float(), nullable=False),
        sa.Column("avg_depth_m", sa.Float(), nullable=False),
        sa.Column("min_temp_k", sa.Float(), nullable=True),
        sa.Column("computer_model", sa.String(255), nullable=True),
        sa.Column("computer_serial", sa.String(255), nullable=True),
        sa.Column("ascent_violations", sa.Integer(), nullable=False),
    )
    op.create_index("ix_dives_upload_id", "dives", ["upload_id"])
    op.create_index("ix_dives_started_at", "dives", ["started_at"])

    op.create_table(
        "samples",
        sa.Column(
            "dive_id",
            sa.Integer(),
            sa.ForeignKey("dives.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("t_s", sa.Float(), primary_key=True),
        sa.Column("depth_m", sa.Float(), nullable=False),
        sa.Column("temp_k", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("samples")
    op.drop_index("ix_dives_started_at", table_name="dives")
    op.drop_index("ix_dives_upload_id", table_name="dives")
    op.drop_table("dives")
    op.drop_index("ix_uploads_sha256", table_name="uploads")
    op.drop_table("uploads")
