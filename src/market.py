from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime

from .models import PredictionMarket, TradeRecord


def clamp01(value: float) -> float:
    return max(1e-6, min(1.0 - 1e-6, value))


@dataclass
class LMSRBinaryMarket:
    market: PredictionMarket
    liquidity_b: float = 75.0
    q_yes: float = field(default=0.0)
    q_no: float = field(default=0.0)
    trade_history: list[TradeRecord] = field(default_factory=list)

    def __post_init__(self) -> None:
        p0 = clamp01(self.market.initial_probability)
        self.q_yes = self.liquidity_b * math.log(p0)
        self.q_no = self.liquidity_b * math.log(1.0 - p0)
        self.market.current_probability = p0

    def _cost(self, q_yes: float, q_no: float) -> float:
        return self.liquidity_b * math.log(
            math.exp(q_yes / self.liquidity_b) + math.exp(q_no / self.liquidity_b)
        )

    def probability(self) -> float:
        yes_exp = math.exp(self.q_yes / self.liquidity_b)
        no_exp = math.exp(self.q_no / self.liquidity_b)
        p = yes_exp / (yes_exp + no_exp)
        self.market.current_probability = clamp01(p)
        return self.market.current_probability

    def move_to_probability(self, target_probability: float) -> tuple[float, float]:
        target_probability = clamp01(target_probability)
        old_q_yes = self.q_yes
        old_cost = self._cost(self.q_yes, self.q_no)
        target_q_gap = self.liquidity_b * math.log(target_probability / (1.0 - target_probability))
        self.q_yes = self.q_no + target_q_gap
        new_cost = self._cost(self.q_yes, self.q_no)
        spend = max(0.0, new_cost - old_cost)
        shares_delta = self.q_yes - old_q_yes
        self.probability()
        return spend, shares_delta

    def record_trade(self, trade: TradeRecord) -> None:
        self.trade_history.append(trade)
        self.market.market_state = "active"
        self.market.status = "open"
        self.market.metadata["last_trade_at"] = datetime.utcnow().isoformat()
