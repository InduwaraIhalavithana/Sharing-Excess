"""drop the legacy_v1_* safety copies kept by 0006

The redesign migration copied the old tables aside so it could be rolled back. Once the redesign is settled those
copies are dead weight (and hold old personal data), so this migration removes them. After it, 0006 can still be
rolled back structurally, but the old rows are gone: restore from a pg_dump taken before this point if needed.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-06
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_LEGACY = ("users", "food_listings", "food_requests", "escalations", "money_donations")


def upgrade() -> None:
    for table in _LEGACY:
        op.execute(f"DROP TABLE IF EXISTS legacy_v1_{table}")


def downgrade() -> None:
    raise RuntimeError(
        "0007 deleted the legacy_v1_* copies, so migration 0006 can no longer be rolled back with its data. "
        "Restore a pg_dump taken before 0007 instead."
    )
