"""users and per-diver ownership

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Existing V1 rows keep user_id NULL until the first account claims them
    for table in ("uploads", "dives"):
        op.add_column(
            table,
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])

    op.drop_constraint("dives_fingerprint_key", "dives", type_="unique")
    op.create_unique_constraint(
        "dives_user_id_fingerprint_key", "dives", ["user_id", "fingerprint"]
    )


def downgrade() -> None:
    op.drop_constraint("dives_user_id_fingerprint_key", "dives", type_="unique")
    op.create_unique_constraint("dives_fingerprint_key", "dives", ["fingerprint"])
    for table in ("dives", "uploads"):
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
