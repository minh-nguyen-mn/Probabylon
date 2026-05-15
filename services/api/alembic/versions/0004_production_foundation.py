"""production auth and forecast foundation

Revision ID: 0004_production_foundation
Revises: 0003_add_username
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_production_foundation"
down_revision = "0003_add_username"
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(index["name"] == index_name for index in _inspector().get_indexes(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _column_exists(table_name, column.name):
        op.add_column(table_name, column)


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], *, unique: bool = False) -> None:
    if not _index_exists(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    _add_column_if_missing("markets", sa.Column("source", sa.String(length=30), nullable=True, server_default="admin"))
    _add_column_if_missing("markets", sa.Column("created_by_user_id", sa.String(length=36), nullable=True))
    _add_column_if_missing("markets", sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    _add_column_if_missing("markets", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    _create_index_if_missing("ix_markets_status", "markets", ["status"], unique=False)
    _create_index_if_missing("ix_markets_category", "markets", ["category"], unique=False)
    _create_index_if_missing("ix_markets_current_probability", "markets", ["current_probability"], unique=False)
    _create_index_if_missing("ix_markets_expires_at", "markets", ["expires_at"], unique=False)
    _create_index_if_missing("ix_markets_created_by_user_id", "markets", ["created_by_user_id"], unique=False)
    _create_index_if_missing("ix_markets_is_featured", "markets", ["is_featured"], unique=False)
    _create_index_if_missing("ix_markets_is_pinned", "markets", ["is_pinned"], unique=False)

    _create_index_if_missing("ix_users_role", "users", ["role"], unique=False)
    _create_index_if_missing("ix_users_is_active", "users", ["is_active"], unique=False)

    if not _table_exists("user_preferences"):
        op.create_table(
            "user_preferences",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("language", sa.String(length=10), nullable=False, server_default="en"),
            sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("ix_user_preferences_user_id", "user_preferences", ["user_id"], unique=True)

    if not _table_exists("refresh_tokens"):
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(length=255), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("rotated_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("ip_address", sa.String(length=64), nullable=True),
        )
    _create_index_if_missing("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    _create_index_if_missing("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    _create_index_if_missing("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"], unique=False)

    if not _table_exists("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("action", sa.String(length=120), nullable=False),
            sa.Column("resource_type", sa.String(length=120), nullable=False),
            sa.Column("resource_id", sa.String(length=120), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    _create_index_if_missing("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    _create_index_if_missing("ix_audit_logs_resource_type", "audit_logs", ["resource_type"], unique=False)
    _create_index_if_missing("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)

    if not _table_exists("market_proposals"):
        op.create_table(
            "market_proposals",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("question", sa.String(length=500), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("resolution_criteria", sa.Text(), nullable=False),
            sa.Column("category", sa.String(length=120), nullable=False, server_default="general"),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(length=40), nullable=False, server_default="pending_review"),
            sa.Column("moderation_notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("duplicate_of_market_id", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("ix_market_proposals_user_id", "market_proposals", ["user_id"], unique=False)
    _create_index_if_missing("ix_market_proposals_status", "market_proposals", ["status"], unique=False)

    if not _table_exists("forecast_queries"):
        op.create_table(
            "forecast_queries",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("user_id", sa.String(length=36), nullable=True),
            sa.Column("question", sa.String(length=500), nullable=False),
            sa.Column("category", sa.String(length=120), nullable=False, server_default="general"),
            sa.Column("probability", sa.Float(), nullable=False, server_default="0.5"),
            sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
            sa.Column("summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("key_uncertainty_drivers", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("disagreement_summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("supporting_evidence", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("related_market_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("agent_reasoning", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("contradictory_signals", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("sources_used", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
            sa.Column("model_version", sa.String(length=120), nullable=False, server_default=""),
            sa.Column("prompt_payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
            sa.Column("structured_output", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    _create_index_if_missing("ix_forecast_queries_user_id", "forecast_queries", ["user_id"], unique=False)
    _create_index_if_missing("ix_forecast_queries_category", "forecast_queries", ["category"], unique=False)
    _create_index_if_missing("ix_forecast_queries_created_at", "forecast_queries", ["created_at"], unique=False)

    if _table_exists("user_preferences"):
        op.execute(
            """
            INSERT INTO user_preferences (id, user_id, language, timezone, created_at, updated_at)
            SELECT
                md5(users.id || '-pref'),
                users.id,
                'en',
                'UTC',
                NOW(),
                NOW()
            FROM users
            ON CONFLICT (user_id) DO NOTHING
            """
        )


def downgrade() -> None:
    op.drop_index("ix_forecast_queries_created_at", table_name="forecast_queries")
    op.drop_index("ix_forecast_queries_category", table_name="forecast_queries")
    op.drop_index("ix_forecast_queries_user_id", table_name="forecast_queries")
    op.drop_table("forecast_queries")

    op.drop_index("ix_market_proposals_status", table_name="market_proposals")
    op.drop_index("ix_market_proposals_user_id", table_name="market_proposals")
    op.drop_table("market_proposals")

    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_refresh_tokens_expires_at", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")

    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_role", table_name="users")

    op.drop_index("ix_markets_is_pinned", table_name="markets")
    op.drop_index("ix_markets_is_featured", table_name="markets")
    op.drop_index("ix_markets_created_by_user_id", table_name="markets")
    op.drop_index("ix_markets_expires_at", table_name="markets")
    op.drop_index("ix_markets_current_probability", table_name="markets")
    op.drop_index("ix_markets_category", table_name="markets")
    op.drop_index("ix_markets_status", table_name="markets")
    op.drop_column("markets", "is_pinned")
    op.drop_column("markets", "is_featured")
    op.drop_column("markets", "created_by_user_id")
    op.drop_column("markets", "source")
