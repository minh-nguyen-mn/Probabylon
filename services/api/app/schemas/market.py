from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MarketCreate(BaseModel):
    question: str = Field(min_length=5, max_length=500)
    description: str = ""
    resolution_criteria: str
    category: str = "general"
    expires_at: datetime
    initial_probability: float | None = Field(default=None, ge=0.01, le=0.99)
    lmsr_b: float | None = Field(default=None, gt=1.0)
    rounds: int | None = Field(default=None, ge=1, le=200)
    max_agents: int | None = Field(default=None, ge=2, le=1000)


class MarketRead(BaseModel):
    id: str
    question: str
    description: str
    resolution_criteria: str
    category: str
    current_probability: float
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class SimulationStart(BaseModel):
    market_id: str
    rounds: int = Field(default=5, ge=1, le=100)
    max_agents: int = Field(default=12, ge=2, le=500)


class DashboardPayload(BaseModel):
    markets: list[dict[str, Any]]
    recent_trades: list[dict[str, Any]]
    active_agents: list[dict[str, Any]]


class MarketDetailPayload(BaseModel):
    market: dict[str, Any]
    probability_history: list[dict[str, Any]]
    trades: list[dict[str, Any]]
    agents: list[dict[str, Any]]
    confidence_distribution: list[dict[str, Any]]
