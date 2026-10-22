"""dives.source: which format a dive's samples came from

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Every dive stored so far came from UDDF
    op.add_column(
        "dives", sa.Column("source", sa.String(8), nullable=False, server_default="uddf")
    )


def downgrade() -> None:
    op.drop_column("dives", "source")
