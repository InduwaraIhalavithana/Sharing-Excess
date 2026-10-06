"""merge the admin and officer roles into one 'adminofficer' staff role

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # A new enum value cannot be used in the same transaction that adds it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'adminofficer'")
    op.execute("UPDATE users SET role = 'adminofficer' WHERE role IN ('admin', 'officer')")


def downgrade() -> None:
    # The two old roles cannot be told apart again; everyone becomes 'admin'.
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'adminofficer'")
