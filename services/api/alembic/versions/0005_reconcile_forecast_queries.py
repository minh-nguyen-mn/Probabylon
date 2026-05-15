"""reconcile forecast query columns for existing databases

Revision ID: 0005_reconcile_forecast_queries
Revises: 0004_production_foundation
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_reconcile_forecast_queries"
down_revision = "0004_production_foundation"
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
    if not _table_exists("forecast_queries"):
        return

    _add_column_if_missing(
        "forecast_queries",
        sa.Column("agent_reasoning", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    _add_column_if_missing(
        "forecast_queries",
        sa.Column("contradictory_signals", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    _add_column_if_missing(
        "forecast_queries",
        sa.Column("sources_used", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    _add_column_if_missing(
        "forecast_queries",
        sa.Column("model_version", sa.String(length=120), nullable=False, server_default=""),
    )
    _add_column_if_missing(
        "forecast_queries",
        sa.Column("prompt_payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    _add_column_if_missing(
        "forecast_queries",
        sa.Column("structured_output", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )

    _create_index_if_missing("ix_forecast_queries_user_id", "forecast_queries", ["user_id"], unique=False)
    _create_index_if_missing("ix_forecast_queries_category", "forecast_queries", ["category"], unique=False)
    _create_index_if_missing("ix_forecast_queries_created_at", "forecast_queries", ["created_at"], unique=False)


def downgrade() -> None:
    if not _table_exists("forecast_queries"):
        return

    if _index_exists("forecast_queries", "ix_forecast_queries_created_at"):
        op.drop_index("ix_forecast_queries_created_at", table_name="forecast_queries")
    if _index_exists("forecast_queries", "ix_forecast_queries_category"):
        op.drop_index("ix_forecast_queries_category", table_name="forecast_queries")
    if _index_exists("forecast_queries", "ix_forecast_queries_user_id"):
        op.drop_index("ix_forecast_queries_user_id", table_name="forecast_queries")

    for column_name in [
        "structured_output",
        "prompt_payload",
        "model_version",
        "sources_used",
        "contradictory_signals",
        "agent_reasoning",
    ]:
        if _column_exists("forecast_queries", column_name):
            op.drop_column("forecast_queries", column_name)
