"""initial tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "markets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("question", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("resolution_criteria", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("initial_probability", sa.Float(), nullable=False),
        sa.Column("current_probability", sa.Float(), nullable=False),
        sa.Column("lmsr_b", sa.Float(), nullable=False),
        sa.Column("q_yes", sa.Float(), nullable=False),
        sa.Column("q_no", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("persona", sa.Text(), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("memory", sa.JSON(), nullable=False),
        sa.Column("capital", sa.Float(), nullable=False),
        sa.Column("reputation", sa.Float(), nullable=False),
        sa.Column("calibration_score", sa.Float(), nullable=False),
        sa.Column("risk_profile", sa.JSON(), nullable=False),
    )
    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("market_id", sa.String(length=36), sa.ForeignKey("markets.id"), nullable=False),
        sa.Column("agent_id", sa.String(length=36), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("estimated_probability", sa.Float(), nullable=False),
        sa.Column("spend", sa.Float(), nullable=False),
        sa.Column("shares_delta", sa.Float(), nullable=False),
        sa.Column("round_index", sa.Integer(), nullable=False),
        sa.Column("pre_probability", sa.Float(), nullable=False),
        sa.Column("post_probability", sa.Float(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("research_history", sa.JSON(), nullable=False),
        sa.Column("active_positions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("trades")
    op.drop_table("agents")
    op.drop_table("markets")
