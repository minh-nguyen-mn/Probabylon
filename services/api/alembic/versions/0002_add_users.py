"""add users table

Revision ID: 0002_add_users
Revises: 0001_initial
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_add_users"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("google_id", sa.String(length=255), nullable=True, unique=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # Seed default admin — password: admin123
    # The hash below will be replaced at runtime by the startup event in main.py
    # We use a raw SQL insert with a placeholder hash; the app startup will fix it
    op.execute(
        """
        INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
        VALUES (
            'a0000000-0000-0000-0000-000000000001',
            'admin@probabylon.local',
            '$2b$12$placeholder_will_be_fixed_by_startup_event_000000000000000000',
            'Admin',
            'admin',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
