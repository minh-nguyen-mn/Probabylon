from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from .llm import PersonaReasoner
from .market import LMSRBinaryMarket
from .models import AgentPersona, PredictionMarket, TradeRecord
from .research import run_independent_research


@dataclass
class AgentState:
    persona: AgentPersona
    capital: float


@dataclass
class SimulationResult:
    market: PredictionMarket
    rounds: int
    final_probability: float
    agent_capitals: dict[str, float]
    trade_count: int
    explainability_log_path: str
    trade_log_path: str


@dataclass
class ProbabylonEngine:
    output_dir: str = "runs"
    liquidity_b: float = 75.0
    _reasoner: PersonaReasoner = field(default_factory=PersonaReasoner)

    def run(
        self,
        question: str,
        description: str,
        resolution_criteria: str,
        category: str = "general",
        rounds: int = 5,
        personas: list[AgentPersona] | None = None,
    ) -> SimulationResult:
        personas = personas or self.default_personas()
        now = datetime.utcnow()
        market = PredictionMarket(
            id=f"mkt-{int(now.timestamp())}",
            question=question,
            description=description,
            resolution_criteria=resolution_criteria,
            category=category,
            created_at=now,
            expires_at=now + timedelta(days=90),
            initial_probability=0.5,
            current_probability=0.5,
            market_state="initialized",
            status="open",
        )
        lmsr = LMSRBinaryMarket(market=market, liquidity_b=self.liquidity_b)
        agent_states = [AgentState(persona=p, capital=p.starting_capital) for p in personas]

        explainability: list[dict] = []
        for round_idx in range(1, rounds + 1):
            for state in agent_states:
                pre_prob = lmsr.probability()
                research = run_independent_research(market.question, state.persona.worldview)
                decision = self._reasoner.decide(
                    persona=state.persona,
                    market=market,
                    research=research,
                    current_probability=pre_prob,
                    capital=state.capital,
                )
                if decision.spend <= 1e-6:
                    continue

                planned_target = pre_prob + (decision.target_probability - pre_prob) * min(1.0, max(0.05, decision.confidence))
                spend, shares_delta = lmsr.move_to_probability(planned_target)
                actual_spend = min(spend, state.capital)

                if actual_spend < spend and spend > 0:
                    # If capital is insufficient, scale movement by affordable fraction.
                    frac = actual_spend / spend
                    scaled_target = pre_prob + (planned_target - pre_prob) * frac
                    spend, shares_delta = lmsr.move_to_probability(scaled_target)
                    actual_spend = spend

                state.capital -= actual_spend
                post_prob = lmsr.probability()
                trade = TradeRecord(
                    market_id=market.id,
                    agent_id=state.persona.id,
                    round_index=round_idx,
                    pre_probability=pre_prob,
                    post_probability=post_prob,
                    spend=actual_spend,
                    shares_delta=shares_delta,
                    confidence=decision.confidence,
                    rationale=decision.rationale,
                    research_query=research.query,
                    research_urls=research.urls,
                    timestamp=datetime.utcnow(),
                )
                lmsr.record_trade(trade)
                explainability.append(
                    {
                        "timestamp": trade.timestamp.isoformat(),
                        "round": round_idx,
                        "agent": state.persona.display_name,
                        "worldview": state.persona.worldview,
                        "risk_tolerance": state.persona.risk_tolerance,
                        "research_query": research.query,
                        "research_snippets": research.snippets,
                        "research_urls": research.urls,
                        "pre_probability": pre_prob,
                        "estimated_probability": decision.estimated_probability,
                        "target_probability": planned_target,
                        "post_probability": post_prob,
                        "confidence": decision.confidence,
                        "spend": actual_spend,
                        "shares_delta": shares_delta,
                        "capital_remaining": state.capital,
                        "rationale": decision.rationale,
                    }
                )

        output_path = Path(self.output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        explain_path = output_path / f"{market.id}-{stamp}-explainability.json"
        trade_path = output_path / f"{market.id}-{stamp}-trades.json"
        explain_path.write_text(json.dumps(explainability, indent=2, ensure_ascii=False), encoding="utf-8")
        trade_path.write_text(
            json.dumps([self._trade_to_dict(t) for t in lmsr.trade_history], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        return SimulationResult(
            market=market,
            rounds=rounds,
            final_probability=lmsr.probability(),
            agent_capitals={a.persona.id: a.capital for a in agent_states},
            trade_count=len(lmsr.trade_history),
            explainability_log_path=str(explain_path),
            trade_log_path=str(trade_path),
        )

    @staticmethod
    def _trade_to_dict(trade: TradeRecord) -> dict:
        return {
            "market_id": trade.market_id,
            "agent_id": trade.agent_id,
            "round_index": trade.round_index,
            "pre_probability": trade.pre_probability,
            "post_probability": trade.post_probability,
            "spend": trade.spend,
            "shares_delta": trade.shares_delta,
            "confidence": trade.confidence,
            "rationale": trade.rationale,
            "research_query": trade.research_query,
            "research_urls": trade.research_urls,
            "timestamp": trade.timestamp.isoformat(),
        }

    @staticmethod
    def default_personas() -> list[AgentPersona]:
        return [
            AgentPersona(
                id="agent-optimist",
                display_name="Macro Optimist",
                worldview="long-run innovation, growth and institutional adaptation",
                risk_tolerance=0.85,
                evidence_priority="trend continuation and technological acceleration",
            ),
            AgentPersona(
                id="agent-skeptic",
                display_name="Skeptical Analyst",
                worldview="base rates, historical failures, and structural friction",
                risk_tolerance=0.35,
                evidence_priority="debunking evidence and downside scenarios",
            ),
            AgentPersona(
                id="agent-narrative",
                display_name="Cultural Signal Reader",
                worldview="media dynamics, memes, social diffusion and narratives",
                risk_tolerance=0.6,
                evidence_priority="social momentum and attention shifts",
            ),
            AgentPersona(
                id="agent-quant",
                display_name="Quant Bayesian",
                worldview="probabilistic calibration and conservative priors",
                risk_tolerance=0.5,
                evidence_priority="cross-source consistency and quantified uncertainty",
            ),
        ]
