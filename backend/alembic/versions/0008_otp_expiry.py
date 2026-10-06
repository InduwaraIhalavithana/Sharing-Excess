"""e-mail codes expire and count wrong guesses

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-06
"""
import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("verification_expires_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("verification_attempts", sa.Integer(), nullable=False, server_default="0"))
    # codes issued before this migration have no expiry: they are dead, a new one must be requested
    op.execute("UPDATE users SET verification_code = NULL WHERE verification_code IS NOT NULL")


def downgrade() -> None:
    op.drop_column("users", "verification_attempts")
    op.drop_column("users", "verification_expires_at")
