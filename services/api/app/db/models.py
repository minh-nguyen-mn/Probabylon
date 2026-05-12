from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(20), default="user")
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    question: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    resolution_criteria: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(120), default="general")
    initial_probability: Mapped[float] = mapped_column(Float, default=0.5)
    current_probability: Mapped[float] = mapped_column(Float, default=0.5)
    lmsr_b: Mapped[float] = mapped_column(Float, default=75.0)
    q_yes: Mapped[float] = mapped_column(Float, default=0.0)
    q_no: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="open")
    source: Mapped[str] = mapped_column(String(30), default="admin")
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    trades: Mapped[list["Trade"]] = relationship(back_populates="market")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    persona: Mapped[str] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text)
    memory: Mapped[dict] = mapped_column(JSON, default=dict)
    capital: Mapped[float] = mapped_column(Float, default=100.0)
    reputation: Mapped[float] = mapped_column(Float, default=0.5)
    calibration_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_profile: Mapped[dict] = mapped_column(JSON, default=dict)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id"), index=True)
    agent_id: Mapped[str] = mapped_column(String(36), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    estimated_probability: Mapped[float] = mapped_column(Float, default=0.5)
    spend: Mapped[float] = mapped_column(Float)
    shares_delta: Mapped[float] = mapped_column(Float, default=0.0)
    round_index: Mapped[int] = mapped_column(Integer, default=1)
    pre_probability: Mapped[float] = mapped_column(Float)
    post_probability: Mapped[float] = mapped_column(Float)
    rationale: Mapped[str] = mapped_column(Text, default="")
    research_history: Mapped[list] = mapped_column(JSON, default=list)
    active_positions: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    market: Mapped[Market] = relationship(back_populates="trades")


class MarketProposal(Base):
    __tablename__ = "market_proposals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    question: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    resolution_criteria: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(120), default="general")
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(40), default="pending_review", index=True)
    moderation_notes: Mapped[str] = mapped_column(Text, default="")
    duplicate_of_market_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ForecastQuery(Base):
    __tablename__ = "forecast_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    question: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(120), default="general")
    probability: Mapped[float] = mapped_column(Float, default=0.5)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    summary: Mapped[str] = mapped_column(Text, default="")
    key_uncertainty_drivers: Mapped[list] = mapped_column(JSON, default=list)
    disagreement_summary: Mapped[str] = mapped_column(Text, default="")
    supporting_evidence: Mapped[list] = mapped_column(JSON, default=list)
    related_market_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
