"""FIT import: extra sample channels, water type and GPS on dives,
start-time fingerprints

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-22

"""
import hashlib
from datetime import timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("samples", sa.Column("heart_rate", sa.Integer(), nullable=True))
    op.add_column("samples", sa.Column("tank_pressure_bar", sa.Float(), nullable=True))
    op.add_column("samples", sa.Column("ndl_s", sa.Integer(), nullable=True))
    op.add_column("dives", sa.Column("water_type", sa.String(8), nullable=True))
    op.add_column("dives", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("dives", sa.Column("longitude", sa.Float(), nullable=True))

    # Fingerprints become a hash of the start time alone, as in
    # app.analysis.stats.fingerprint (copied so later code changes can't
    # change what this migration does). If a diver has two dives with the
    # same start second, the later one keeps its old fingerprint.
    conn = op.get_bind()
    taken: set[tuple[int, str]] = set()
    rows = conn.execute(sa.text("SELECT id, user_id, started_at FROM dives ORDER BY id")).all()
    for dive_id, user_id, started_at in rows:
        utc = started_at.astimezone(timezone.utc)
        fp = hashlib.sha256(utc.strftime("%Y-%m-%dT%H:%M:%S").encode()).hexdigest()
        if (user_id, fp) in taken:
            continue
        taken.add((user_id, fp))
        conn.execute(
            sa.text("UPDATE dives SET fingerprint = :fp WHERE id = :id"), {"fp": fp, "id": dive_id}
        )


def downgrade() -> None:
    # Old sample-based fingerprints can't be rebuilt exactly; the new ones
    # still dedupe, so they are left in place.
    op.drop_column("dives", "longitude")
    op.drop_column("dives", "latitude")
    op.drop_column("dives", "water_type")
    op.drop_column("samples", "ndl_s")
    op.drop_column("samples", "tank_pressure_bar")
    op.drop_column("samples", "heart_rate")
