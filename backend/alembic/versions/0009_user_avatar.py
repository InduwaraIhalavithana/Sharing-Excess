"""profile photo for donors and recipients

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-08
"""
import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar")
