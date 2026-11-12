"""cert cards: the diver's certification cards, with photos stored as files

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cert_cards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agency", sa.String(40), nullable=False),
        sa.Column("level", sa.String(16), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("number", sa.String(40), nullable=False),
        sa.Column("certified_on", sa.Date(), nullable=True),
        sa.Column("front_file", sa.String(80), nullable=True),
        sa.Column("back_file", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cert_cards_user_id", "cert_cards", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_cert_cards_user_id", table_name="cert_cards")
    op.drop_table("cert_cards")
