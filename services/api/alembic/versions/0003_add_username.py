"""add username to users

Revision ID: 0003_add_username
Revises: 0002_add_users
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_username"
down_revision = "0002_add_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add username column as nullable first to allow existing users
    op.add_column("users", sa.Column("username", sa.String(length=50), nullable=True))
    
    # Update existing users to have a username based on their email (optional but recommended)
    op.execute("UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL")
    
    # Create index and make it unique
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
