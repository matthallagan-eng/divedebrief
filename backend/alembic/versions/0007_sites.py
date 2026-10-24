"""sites, plus entry and exit GPS points on dives

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-23

Existing dives are grouped into sites the first time the diver opens the map
(app.sites.assign_sites), so no data is moved here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("water_type", sa.String(8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for col in ("entry_latitude", "entry_longitude", "exit_latitude", "exit_longitude"):
        op.add_column("dives", sa.Column(col, sa.Float(), nullable=True))
    op.add_column(
        "dives",
        sa.Column(
            "site_id", sa.Integer(), sa.ForeignKey("sites.id", ondelete="SET NULL"), nullable=True
        ),
    )
    op.create_index("ix_dives_site_id", "dives", ["site_id"])


def downgrade() -> None:
    op.drop_index("ix_dives_site_id", "dives")
    for col in ("site_id", "exit_longitude", "exit_latitude", "entry_longitude", "entry_latitude"):
        op.drop_column("dives", col)
    op.drop_table("sites")
