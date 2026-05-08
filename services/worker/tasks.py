from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from hashlib import sha256
from urllib.parse import quote_plus

import httpx
import redis.asyncio as redis
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Agent, Market, Trade
from app.db.session import SessionLocal
from app.llm.providers import get_provider
from app.markets.lmsr import move_to_probability, probability
from worker.celery_app import celery_app


@dataclass
class AgentSnapshot:
    id: str
    persona: str
    capital: float
    risk: float


async def _search(query: str) -> list[str]:
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            r = await client.get(url)
            return [f"status={r.status_code}", f"url={str(r.url)}"]
    except Exception as exc:
        return [f"search_error={exc}"]


def _risk_from_id(agent_id: str) -> float:
    digest = sha256(agent_id.encode("utf-8")).hexdigest()
    scaled = int(digest[:6], 16) / float(0xFFFFFF)
    return round(0.2 + scaled * 0.7, 2)


async def _ensure_agents(session, max_agents: int) -> list[AgentSnapshot]:
    rows = (await session.execute(select(Agent).limit(max_agents))).scalars().all()
    if rows:
        return [AgentSnapshot(id=a.id, persona=a.persona, capital=a.capital, risk=float(a.risk_profile.get("risk", 0.5))) for a in rows]
    snapshots: list[AgentSnapshot] = []
    for i in range(max_agents):
        risk = _risk_from_id(f"agent-{i+1}")
        agent = Agent(
            id=f"agent-{i+1}",
            persona=f"Agent {i+1} | worldview {i+1 % 5} | risk {risk}",
            system_prompt="Autonomous probabilistic trader",
            risk_profile={"risk": risk},
            memory={"events": []},
            capital=100.0,
        )
        session.add(agent)
        snapshots.append(AgentSnapshot(id=agent.id, persona=agent.persona, capital=agent.capital, risk=risk))
    await session.commit()
    return snapshots


def _heuristic_inference(question: str, persona: str, evidence: list[str], market_probability: float, risk: float) -> dict:
    text = f"{question} | {persona} | {' '.join(evidence)}".lower()
    positive = ["breakthrough", "growth", "adoption", "approval", "funding", "support"]
    negative = ["delay", "ban", "collapse", "recession", "risk", "failure", "war"]
    pos = sum(text.count(word) for word in positive)
    neg = sum(text.count(word) for word in negative)
    sentiment = (pos - neg) * 0.03
    worldview_bias = (int(sha256(persona.encode()).hexdigest()[:4], 16) / 0xFFFF - 0.5) * 0.18
    estimate = max(0.01, min(0.99, market_probability + sentiment + worldview_bias))
    confidence = max(0.05, min(0.95, 0.3 + risk * 0.5 + min(0.2, abs(sentiment))))
    return {
        "estimated_probability": estimate,
        "confidence": confidence,
        "rationale": f"Evidence-driven estimate (pos={pos}, neg={neg}, bias={worldview_bias:.3f}).",
    }


async def _agent_think(provider, market: Market, agent: AgentSnapshot, market_probability: float) -> dict:
    base_query = f"{market.question} latest evidence {agent.persona}"
    first_search = await _search(base_query)
    followup_query = f"{market.question} opposing arguments {agent.persona}"
    second_search = await _search(followup_query)
    evidence = [*first_search, *second_search]
    prompt = (
        f"Question: {market.question}\n"
        f"Resolution criteria: {market.resolution_criteria}\n"
        f"Current probability: {market_probability:.4f}\n"
        f"Persona: {agent.persona}\n"
        f"Evidence 1: {first_search}\n"
        f"Evidence 2: {second_search}\n"
        "Reason through stages: interpret, uncertainty drivers, hypothesis, self-critique, revised estimate.\n"
        "Respond as JSON with estimated_probability, confidence, rationale."
    )
    try:
        raw = await provider.generate("You are an autonomous AI market trader.", prompt, 0.35, 300)
        data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
        est = float(data.get("estimated_probability", market_probability))
        conf = float(data.get("confidence", agent.risk))
        return {
            "estimated_probability": max(0.01, min(0.99, est)),
            "confidence": max(0.01, min(0.99, conf)),
            "rationale": str(data.get("rationale", "LLM reasoning summary unavailable.")),
            "evidence": evidence,
        }
    except Exception:
        fallback = _heuristic_inference(market.question, agent.persona, evidence, market_probability, agent.risk)
        fallback["evidence"] = evidence
        return fallback


async def _simulate(market_id: str, rounds: int, max_agents: int) -> None:
    pub = redis.from_url(settings.redis_url)
    provider = get_provider(settings.default_llm_provider)
    async with SessionLocal() as session:
        market = await session.get(Market, market_id)
        if not market:
            return
        market.status = "running"
        await session.commit()
        agents = await _ensure_agents(session, max_agents)
        for r in range(1, rounds + 1):
            p = probability(market.lmsr_b, market.q_yes, market.q_no)
            thoughts = await asyncio.gather(*[_agent_think(provider, market, agent, p) for agent in agents])
            ranked = sorted(
                zip(agents, thoughts),
                key=lambda item: abs(item[1]["estimated_probability"] - p) * item[1]["confidence"],
                reverse=True,
            )
            for agent, data in ranked:
                p = probability(market.lmsr_b, market.q_yes, market.q_no)
                confidence = max(0.01, min(1.0, float(data["confidence"])))
                estimated_probability = max(0.01, min(0.99, float(data["estimated_probability"])))
                target = p + (estimated_probability - p) * confidence
                qy, qn, spend = move_to_probability(market.lmsr_b, market.q_yes, market.q_no, target)
                spend = min(spend, agent.capital)
                shares_delta = qy - market.q_yes
                market.q_yes = qy
                market.q_no = qn
                market.current_probability = probability(market.lmsr_b, market.q_yes, market.q_no)
                agent.capital -= spend
                db_agent = await session.get(Agent, agent.id)
                if db_agent:
                    db_agent.capital = agent.capital
                    memory_events = list(db_agent.memory.get("events", []))[-24:]
                    memory_events.append(
                        {
                            "round": r,
                            "market_id": market.id,
                            "estimated_probability": estimated_probability,
                            "post_probability": market.current_probability,
                            "confidence": confidence,
                        }
                    )
                    db_agent.memory = {"events": memory_events}
                session.add(
                    Trade(
                        market_id=market.id,
                        agent_id=agent.id,
                        confidence=confidence,
                        estimated_probability=estimated_probability,
                        spend=spend,
                        shares_delta=shares_delta,
                        round_index=r,
                        pre_probability=p,
                        post_probability=market.current_probability,
                        rationale=str(data["rationale"]),
                        research_history=data["evidence"],
                        active_positions={"confidence": confidence, "target_probability": target},
                    )
                )
                await session.commit()
                await pub.publish(
                    "probabylon.market.events",
                    json.dumps(
                        {
                            "type": "trade",
                            "market_id": market.id,
                            "round": r,
                            "agent_id": agent.id,
                            "probability": market.current_probability,
                            "estimated_probability": estimated_probability,
                            "confidence": confidence,
                            "spend": spend,
                            "rationale": str(data["rationale"])[:220],
                            "shares_delta": shares_delta,
                        }
                    ),
                )
        market.status = "open"
        await session.commit()
        await pub.publish(
            "probabylon.market.events",
            json.dumps({"type": "simulation_completed", "market_id": market.id, "final_probability": market.current_probability}),
        )
    await pub.close()


@celery_app.task(name="worker.tasks.run_simulation")
def run_simulation(market_id: str, rounds: int = 5, max_agents: int = 12) -> dict:
    asyncio.run(_simulate(market_id=market_id, rounds=rounds, max_agents=max_agents))
    return {"market_id": market_id, "status": "completed"}
