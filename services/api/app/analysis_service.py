from __future__ import annotations

import json
from datetime import datetime, timezone
from statistics import mean

from app.core.config import settings
from app.db.models import Agent, Market
from app.llm.providers import LLMProviderError, get_provider
from app.schemas.market import ForecastAgentReasoning, ForecastResult, ForecastSource


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_json(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object found in LLM response")
    return json.loads(raw[start : end + 1])


def _related_market_sources(markets: list[Market]) -> list[ForecastSource]:
    return [
        ForecastSource(
            label=market.question,
            source_type="internal_market",
            status="live",
            timestamp=market.created_at.isoformat(),
            detail=f"Current probability {market.current_probability:.2f} in {market.category}",
        )
        for market in markets[:5]
    ]


def _fallback_result(question: str, category: str, related_markets: list[Market], agents: list[Agent]) -> ForecastResult:
    market_average = mean([market.current_probability for market in related_markets]) if related_markets else 0.5
    confidence = 0.34 if related_markets else 0.12
    bullish = round(max(0.01, min(0.99, market_average)), 4)
    bearish = round(max(0.01, min(0.99, 1 - bullish)), 4)
    agent_reasoning = []
    for agent in agents[:3]:
        agent_reasoning.append(
            ForecastAgentReasoning(
                agent=agent.persona,
                stance="insufficient-data",
                confidence=confidence,
                reasoning="The system only has internal platform context and cannot responsibly infer a stronger directional view.",
                supporting_evidence=[market.question for market in related_markets[:2]] or ["No directly related internal markets were found."],
                contradictory_signals=["External macro, sentiment, and event data were not available during this run."],
            )
        )

    return ForecastResult(
        id="",
        final_prediction="Insufficient reliable data available to generate a high-confidence forecast.",
        probability=round(bullish, 4),
        confidence_score=round(confidence, 4),
        supporting_evidence=[market.question for market in related_markets[:3]] or ["No related internal evidence found."],
        agent_reasoning=agent_reasoning,
        contradictory_signals=[
            "Current evidence is limited to internal platform context.",
            "No trusted external live datasets were attached to this forecast.",
        ],
        data_sources_used=_related_market_sources(related_markets),
        timestamp=_now_iso(),
        model_version=f"{settings.default_llm_provider}:{settings.default_llm_model}",
        probability_distribution={"bullish": bullish, "bearish": bearish},
        summary=f"The platform does not currently have enough reliable evidence to answer '{question}' in category '{category}' with strong confidence.",
        insufficient_data=True,
    )


async def generate_structured_forecast(
    question: str,
    category: str,
    context: str,
    related_markets: list[Market],
    agents: list[Agent],
) -> ForecastResult:
    if not settings.openai_api_key:
        return _fallback_result(question, category, related_markets, agents)

    provider = get_provider(settings.default_llm_provider)
    source_lines = [
        f"- {market.question} | category={market.category} | probability={market.current_probability:.3f} | expires={market.expires_at.isoformat()}"
        for market in related_markets[:5]
    ]
    agent_lines = [
        f"- {agent.persona} | reputation={agent.reputation:.2f} | calibration={agent.calibration_score:.2f} | worldview={agent.risk_profile.get('worldview', agent.persona)}"
        for agent in agents[:5]
    ]
    prompt = (
        "You are the Probabylon consensus engine. Produce a strict JSON object only.\n"
        "Do not reveal hidden chain-of-thought. Summarize concise, evidence-backed rationale.\n"
        "If the evidence is weak, explicitly say the forecast has insufficient data and lower confidence.\n"
        "Required keys: final_prediction, probability, confidence_score, supporting_evidence, agent_reasoning, contradictory_signals, probability_distribution, summary.\n"
        "agent_reasoning must be an array of objects with keys agent, stance, confidence, reasoning, supporting_evidence, contradictory_signals.\n"
        "probability_distribution must include bullish and bearish values summing to 1.\n"
        f"Question: {question}\n"
        f"Category: {category}\n"
        f"Context: {context or 'No additional user context provided.'}\n"
        "Internal evidence:\n"
        + ("\n".join(source_lines) if source_lines else "- No related internal markets found.")
        + "\nAgent roster:\n"
        + ("\n".join(agent_lines) if agent_lines else "- No active agents available.")
    )
    try:
        raw = await provider.generate(
            "You format transparent, compact forecasting summaries as strict JSON.",
            prompt,
            0.1,
            900,
        )
        data = _extract_json(raw)
        bullish = float(data.get("probability_distribution", {}).get("bullish", data.get("probability", 0.5)))
        bullish = max(0.01, min(0.99, bullish))
        bearish = round(1 - bullish, 4)
        probability = max(0.01, min(0.99, float(data.get("probability", bullish))))
        confidence = max(0.01, min(0.99, float(data.get("confidence_score", 0.3))))
        return ForecastResult(
            id="",
            final_prediction=str(data.get("final_prediction", "")).strip() or "Forecast generated with limited detail.",
            probability=round(probability, 4),
            confidence_score=round(confidence, 4),
            supporting_evidence=[str(item) for item in data.get("supporting_evidence", [])][:6],
            agent_reasoning=[
                ForecastAgentReasoning(
                    agent=str(item.get("agent", "Agent")),
                    stance=str(item.get("stance", "neutral")),
                    confidence=max(0.01, min(0.99, float(item.get("confidence", confidence)))),
                    reasoning=str(item.get("reasoning", "")).strip(),
                    supporting_evidence=[str(value) for value in item.get("supporting_evidence", [])][:4],
                    contradictory_signals=[str(value) for value in item.get("contradictory_signals", [])][:4],
                )
                for item in data.get("agent_reasoning", [])[:5]
                if isinstance(item, dict)
            ],
            contradictory_signals=[str(item) for item in data.get("contradictory_signals", [])][:6],
            data_sources_used=_related_market_sources(related_markets),
            timestamp=_now_iso(),
            model_version=f"{settings.default_llm_provider}:{settings.default_llm_model}",
            probability_distribution={"bullish": round(bullish, 4), "bearish": bearish},
            summary=str(data.get("summary", "")).strip(),
            insufficient_data=confidence < 0.35 or not related_markets,
        )
    except (LLMProviderError, ValueError, TypeError, json.JSONDecodeError):
        return _fallback_result(question, category, related_markets, agents)
