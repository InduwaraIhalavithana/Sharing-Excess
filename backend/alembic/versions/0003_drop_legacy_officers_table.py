"""drop the legacy PHP-era `officers` table

Staff live in `users` (role 'adminofficer') since migration 0002; nothing reads this table.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS officers")
    op.execute("DROP TYPE IF EXISTS officer_role")
    op.execute("DROP TYPE IF EXISTS officer_status")


def downgrade() -> None:
    # Recreates the (empty) structure only - the old rows are not restored.
    role = sa.Enum("officer", "admin", name="officer_role")
    status = sa.Enum("active", "inactive", name="officer_status")
    op.create_table(
        "officers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(100), nullable=False, unique=True),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("role", role, nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()")),
    )
