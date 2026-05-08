from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class PredictionMarket:
    id: str
    question: str
    description: str
    resolution_criteria: str
    category: str
    created_at: datetime
    expires_at: datetime
    initial_probability: float
    current_probability: float
    market_state: str
    status: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentPersona:
    id: str
    display_name: str
    worldview: str
    risk_tolerance: float
    evidence_priority: str
    starting_capital: float = 100.0


@dataclass
class ResearchPacket:
    query: str
    snippets: list[str]
    urls: list[str]


@dataclass
class TradeDecision:
    estimated_probability: float
    confidence: float
    rationale: str
    edge: float
    target_probability: float
    spend: float
    buy_shares: float


@dataclass
class TradeRecord:
    market_id: str
    agent_id: str
    round_index: int
    pre_probability: float
    post_probability: float
    spend: float
    shares_delta: float
    confidence: float
    rationale: str
    research_query: str
    research_urls: list[str]
    timestamp: datetime
