from __future__ import annotations

import json
import random
from typing import Any

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from .config import ANTHROPIC_API_KEY, DEFAULT_MODEL, OPENAI_API_KEY
from .models import AgentPersona, PredictionMarket, ResearchPacket, TradeDecision


class PersonaReasoner:
    def __init__(self) -> None:
        self.model = DEFAULT_MODEL
        self.anthropic = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY and Anthropic else None
        self.openai = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY and OpenAI else None

    def decide(
        self,
        persona: AgentPersona,
        market: PredictionMarket,
        research: ResearchPacket,
        current_probability: float,
        capital: float,
    ) -> TradeDecision:
        if self.anthropic and self._is_anthropic_model(self.model):
            return self._anthropic_decide(persona, market, research, current_probability, capital)
        if self.openai and self._is_openai_model(self.model):
            return self._openai_decide(persona, market, research, current_probability, capital)
        if self.openai:
            return self._openai_decide(persona, market, research, current_probability, capital)
        if self.anthropic:
            return self._anthropic_decide(persona, market, research, current_probability, capital)
        return self._fallback_decide(persona, market, research, current_probability, capital)

    @staticmethod
    def _is_openai_model(model: str) -> bool:
        normalized = model.lower()
        return normalized.startswith(("gpt", "o1", "o3", "o4"))

    @staticmethod
    def _is_anthropic_model(model: str) -> bool:
        return "claude" in model.lower()

    def _prompt(
        self,
        persona: AgentPersona,
        market: PredictionMarket,
        research: ResearchPacket,
        current_probability: float,
        capital: float,
    ) -> str:
        return (
            "You are a prediction market persona. Return strict JSON with keys: "
            "estimated_probability, confidence, rationale, edge, target_probability, spend.\n"
            f"Persona worldview: {persona.worldview}\n"
            f"Risk tolerance: {persona.risk_tolerance}\n"
            f"Evidence priority: {persona.evidence_priority}\n"
            f"Question: {market.question}\n"
            f"Resolution criteria: {market.resolution_criteria}\n"
            f"Current market probability: {current_probability:.4f}\n"
            f"Capital available: {capital:.4f}\n"
            f"Research query: {research.query}\n"
            "Research snippets:\n- " + "\n- ".join(research.snippets[:6]) + "\n"
            "Constraints: probabilities in [0,1], confidence in [0,1], spend >= 0 and <= capital.\n"
        )

    def _anthropic_decide(self, persona: AgentPersona, market: PredictionMarket, research: ResearchPacket, current_probability: float, capital: float) -> TradeDecision:
        prompt = self._prompt(persona, market, research, current_probability, capital)
        response = self.anthropic.messages.create(
            model=self.model,
            max_tokens=600,
            temperature=0.4,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(getattr(block, "text", "") for block in response.content)
        return self._from_json_or_fallback(text, persona, market, research, current_probability, capital)

    def _openai_decide(self, persona: AgentPersona, market: PredictionMarket, research: ResearchPacket, current_probability: float, capital: float) -> TradeDecision:
        prompt = self._prompt(persona, market, research, current_probability, capital)
        response = self.openai.responses.create(
            model=self.model,
            temperature=0.4,
            input=prompt,
        )
        text = getattr(response, "output_text", "") or str(response)
        return self._from_json_or_fallback(text, persona, market, research, current_probability, capital)

    def _from_json_or_fallback(
        self,
        text: str,
        persona: AgentPersona,
        market: PredictionMarket,
        research: ResearchPacket,
        current_probability: float,
        capital: float,
    ) -> TradeDecision:
        try:
            start = text.find("{")
            end = text.rfind("}")
            obj = json.loads(text[start : end + 1])
            est = float(obj["estimated_probability"])
            conf = float(obj["confidence"])
            target = float(obj["target_probability"])
            spend = float(obj["spend"])
            edge = float(obj.get("edge", abs(est - current_probability)))
            rationale = str(obj.get("rationale", "No rationale provided."))
            return self._normalize(est, conf, rationale, edge, target, spend, current_probability, capital)
        except Exception:
            return self._fallback_decide(persona, market, research, current_probability, capital)

    def _fallback_decide(
        self,
        persona: AgentPersona,
        market: PredictionMarket,
        research: ResearchPacket,
        current_probability: float,
        capital: float,
    ) -> TradeDecision:
        seed = hash((persona.id, market.id, research.query, tuple(research.snippets[:3])))
        rng = random.Random(seed)
        drift = (rng.random() - 0.5) * 0.24
        est = max(0.01, min(0.99, current_probability + drift))
        conf = max(0.05, min(0.95, 0.35 + persona.risk_tolerance * 0.5 + rng.random() * 0.2))
        edge = abs(est - current_probability)
        target = max(0.01, min(0.99, current_probability + (est - current_probability) * conf))
        spend = min(capital, capital * conf * edge * 1.5)
        rationale = (
            f"Fallback reasoner: worldview='{persona.worldview}', evidence='{persona.evidence_priority}', "
            f"estimated p={est:.2f} from sparse external snippets."
        )
        return self._normalize(est, conf, rationale, edge, target, spend, current_probability, capital)

    def _normalize(
        self,
        estimated_probability: float,
        confidence: float,
        rationale: str,
        edge: float,
        target_probability: float,
        spend: float,
        current_probability: float,
        capital: float,
    ) -> TradeDecision:
        est = max(0.001, min(0.999, estimated_probability))
        conf = max(0.0, min(1.0, confidence))
        target = max(0.001, min(0.999, target_probability))
        if abs(target - current_probability) < 1e-4:
            target = max(0.001, min(0.999, current_probability + (est - current_probability) * max(0.1, conf)))
        edge = max(0.0, edge)
        spend = max(0.0, min(capital, spend))
        return TradeDecision(
            estimated_probability=est,
            confidence=conf,
            rationale=rationale,
            edge=edge,
            target_probability=target,
            spend=spend,
            buy_shares=0.0,
        )
