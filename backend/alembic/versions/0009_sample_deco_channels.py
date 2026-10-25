"""sample deco channels: the dive computer's ceiling, time to surface,
nitrogen load, CNS and ppO2, for the profile graphs

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-24

Dives imported earlier keep nulls here until their FIT file is uploaded again.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ("ceiling_m", sa.Float()),
    ("tts_s", sa.Integer()),
    ("n2_load_pct", sa.Float()),
    ("cns_pct", sa.Float()),
    ("po2_bar", sa.Float()),
]


def upgrade() -> None:
    for name, kind in COLUMNS:
        op.add_column("samples", sa.Column(name, kind, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column("samples", name)
