from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from statistics import pstdev
from urllib.parse import quote_plus, urlparse

import httpx
import redis.asyncio as redis
from sqlalchemy import select

from app.core.config import settings
from app.db.models import Agent, Market, Trade
from app.db.session import SessionLocal
from app.llm.providers import get_provider
from app.markets.lmsr import move_to_probability, probability
from worker.celery_app import celery_app

logger = logging.getLogger(__name__)


PERSONA_LIBRARY = [
    {
        "id": "techno-optimist",
        "title": "Techno-Optimist",
        "worldview": "Believes innovation compounds quickly and adoption curves surprise to the upside.",
        "style": "leans bullish when technical progress looks commercially real",
        "risk": 0.77,
        "reflexivity": 0.52,
        "contrarian": 0.18,
    },
    {
        "id": "macro-bear",
        "title": "Macro Bear",
        "worldview": "Focuses on rates, funding stress, regulation, and structural friction.",
        "style": "leans bearish when narratives ignore macro constraints",
        "risk": 0.38,
        "reflexivity": -0.2,
        "contrarian": 0.46,
    },
    {
        "id": "accelerationist",
        "title": "Accelerationist",
        "worldview": "Assumes competition and scale drive abrupt breakthroughs.",
        "style": "chases upside when momentum and technical evidence align",
        "risk": 0.88,
        "reflexivity": 0.72,
        "contrarian": 0.08,
    },
    {
        "id": "ai-safety",
        "title": "AI Safety Researcher",
        "worldview": "Interprets progress through failure modes, deployment caution, and governance.",
        "style": "marks down outcomes with unresolved safety bottlenecks",
        "risk": 0.33,
        "reflexivity": -0.1,
        "contrarian": 0.55,
    },
    {
        "id": "skeptic",
        "title": "Skeptic",
        "worldview": "Prefers base rates and discounts headlines until evidence compounds.",
        "style": "fades excitement and weak sourcing",
        "risk": 0.29,
        "reflexivity": -0.22,
        "contrarian": 0.64,
    },
    {
        "id": "contrarian",
        "title": "Contrarian",
        "worldview": "Looks for overcrowded consensus and narrative exhaustion.",
        "style": "actively trades against crowded moves",
        "risk": 0.58,
        "reflexivity": -0.45,
        "contrarian": 0.86,
    },
    {
        "id": "meme-speculator",
        "title": "Meme Speculator",
        "worldview": "Tracks attention, cultural salience, and online amplification.",
        "style": "reacts quickly to sentiment bursts and volatility",
        "risk": 0.81,
        "reflexivity": 0.6,
        "contrarian": 0.16,
    },
    {
        "id": "geopolitical-analyst",
        "title": "Geopolitical Analyst",
        "worldview": "Frames outcomes through state incentives, conflict, and strategic rivalry.",
        "style": "marks down outcomes vulnerable to political shocks",
        "risk": 0.44,
        "reflexivity": -0.05,
        "contrarian": 0.42,
    },
    {
        "id": "quant-trader",
        "title": "Quant Trader",
        "worldview": "Optimizes around calibration, dispersion, and updating discipline.",
        "style": "sizes with confidence and recent volatility",
        "risk": 0.54,
        "reflexivity": 0.12,
        "contrarian": 0.34,
    },
    {
        "id": "doomist",
        "title": "Doomist",
        "worldview": "Weights tail risks, breakdown scenarios, and asymmetric downside.",
        "style": "prefers expensive insurance over optimistic extrapolation",
        "risk": 0.41,
        "reflexivity": -0.18,
        "contrarian": 0.51,
    },
]


@dataclass
class AgentSnapshot:
    id: str
    title: str
    worldview: str
    capital: float
    risk: float
    reflexivity: float
    contrarian: float
    memory: dict


def _clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _extract_json_object(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(raw[start : end + 1])


async def _search(query: str) -> list[dict]:
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            response.raise_for_status()
        html = response.text
        matches = re.findall(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
            html,
            flags=re.S,
        )
        results = []
        for href, title_html, snippet_html in matches[:5]:
            title = _clean_text(title_html)
            snippet = _clean_text(snippet_html)
            results.append(
                {
                    "title": title,
                    "url": href,
                    "snippet": snippet,
                    "source": urlparse(href).netloc or "web",
                }
            )
        return results or [{"title": "No search results", "url": "", "snippet": query, "source": "web"}]
    except Exception as exc:
        logger.warning("search failed for '%s': %s", query, exc)
        return [{"title": "Search unavailable", "url": "", "snippet": str(exc), "source": "system"}]


async def _fetch_page_summary(url: str) -> str:
    if not url:
        return ""
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            response.raise_for_status()
        return _clean_text(response.text)[:900]
    except Exception:
        return ""


async def _gather_research(question: str, agent: AgentSnapshot) -> list[dict]:
    queries = [
        f"{question} latest evidence",
        f"{question} opposing case",
        f"{question} {agent.title} perspective",
    ]
    batches = await asyncio.gather(*[_search(query) for query in queries])
    merged: list[dict] = []
    seen_urls: set[str] = set()
    for batch in batches:
        for item in batch:
            url = item.get("url", "")
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            merged.append(item)
    summaries = await asyncio.gather(*[_fetch_page_summary(item.get("url", "")) for item in merged[:3]])
    for item, summary in zip(merged[:3], summaries):
        if summary:
            item["page_summary"] = summary
    return merged[:6]


async def _ensure_agents(session, max_agents: int) -> list[AgentSnapshot]:
    desired = PERSONA_LIBRARY[: max_agents]
    existing_rows = {row.id: row for row in (await session.execute(select(Agent))).scalars().all()}
    for template in desired:
        if template["id"] in existing_rows:
            continue
        session.add(
            Agent(
                id=template["id"],
                persona=template["title"],
                system_prompt=template["worldview"],
                memory={"events": [], "stance_history": []},
                capital=100.0,
                reputation=0.5,
                calibration_score=0.0,
                risk_profile={
                    "risk": template["risk"],
                    "style": template["style"],
                    "worldview": template["worldview"],
                    "reflexivity": template["reflexivity"],
                    "contrarian": template["contrarian"],
                },
            )
        )
    await session.commit()
    rows = list((await session.execute(select(Agent))).scalars().all())
    agent_rows = [row for row in rows if row.id in {template["id"] for template in desired}]
    agent_rows.sort(key=lambda row: [template["id"] for template in desired].index(row.id))
    return [
        AgentSnapshot(
            id=row.id,
            title=row.persona,
            worldview=row.risk_profile.get("worldview", row.persona),
            capital=row.capital,
            risk=float(row.risk_profile.get("risk", 0.5)),
            reflexivity=float(row.risk_profile.get("reflexivity", 0.0)),
            contrarian=float(row.risk_profile.get("contrarian", 0.3)),
            memory=row.memory or {"events": [], "stance_history": []},
        )
        for row in agent_rows[:max_agents]
    ]


def _fallback_from_research(research: list[dict], market_probability: float, agent: AgentSnapshot, error: Exception) -> dict:
    snippets = [item.get("snippet", "") for item in research if item.get("snippet")]
    evidence_summary = "; ".join(snippets[:2]) or "No usable live evidence retrieved."
    return {
        "tradeable": False,
        "estimated_probability": market_probability,
        "confidence": 0.0,
        "aggression": 0.0,
        "thesis": "No trade: fresh model inference unavailable.",
        "rationale": f"Research was collected but no live LLM reasoning was available: {evidence_summary}",
        "self_critique": f"Provider error: {error}",
        "evidence_used": [item.get("title") or item.get("url") for item in research[:3]],
        "sources": research[:3],
    }


async def _agent_think(provider, market: Market, agent: AgentSnapshot, market_probability: float, round_index: int) -> dict:
    research = await _gather_research(market.question, agent)
    evidence_lines = []
    for idx, item in enumerate(research[:5], start=1):
        evidence_lines.append(
            f"{idx}. {item.get('title', 'Untitled')} | {item.get('source', 'source')} | "
            f"{item.get('snippet', '')} | {item.get('url', '')}"
        )
    prompt = (
        f"Question: {market.question}\n"
        f"Description: {market.description}\n"
        f"Resolution criteria: {market.resolution_criteria}\n"
        f"Round: {round_index}\n"
        f"Current probability: {market_probability:.4f}\n"
        f"Persona title: {agent.title}\n"
        f"Persona worldview: {agent.worldview}\n"
        f"Risk appetite: {agent.risk:.2f}\n"
        f"Reflexivity bias: {agent.reflexivity:.2f}\n"
        f"Contrarian impulse: {agent.contrarian:.2f}\n"
        f"Recent own memory: {json.dumps(agent.memory.get('events', [])[-4:])}\n"
        "Live evidence:\n"
        + "\n".join(evidence_lines)
        + "\nReturn strict JSON with keys: estimated_probability, confidence, aggression, thesis, rationale, self_critique, evidence_used.\n"
        "Use only the evidence above. Do not invent citations. Make the rationale specific to the persona. "
        "Confidence must reflect uncertainty, disagreement, and source quality. evidence_used must reference titles from the evidence list."
    )
    try:
        raw = await provider.generate(
            "You are a distinct autonomous prediction-market agent with a stable worldview. "
            "Think in evidence, uncertainty, and positioning. Never fabricate sources.",
            prompt,
            0.45,
            700,
        )
        data = _extract_json_object(raw)
        return {
            "tradeable": True,
            "estimated_probability": max(0.01, min(0.99, float(data.get("estimated_probability", market_probability)))),
            "confidence": max(0.01, min(0.99, float(data.get("confidence", agent.risk)))),
            "aggression": max(0.01, min(1.0, float(data.get("aggression", agent.risk)))),
            "thesis": str(data.get("thesis", "")).strip(),
            "rationale": str(data.get("rationale", "LLM reasoning summary unavailable.")).strip(),
            "self_critique": str(data.get("self_critique", "")).strip(),
            "evidence_used": list(data.get("evidence_used", []))[:4],
            "sources": research,
        }
    except Exception as exc:
        logger.exception("LLM reasoning failed for %s", agent.id)
        return _fallback_from_research(research, market_probability, agent, exc)


def _position_trade(
    market: Market,
    market_probability: float,
    estimated_probability: float,
    confidence: float,
    aggression: float,
    agent: AgentSnapshot,
    recent_market_probs: list[float],
) -> tuple[float, float]:
    market_drift = market_probability - recent_market_probs[0]
    volatility = pstdev(recent_market_probs) if len(recent_market_probs) > 1 else 0.0
    edge = estimated_probability - market_probability
    adjusted_target = estimated_probability
    adjusted_target += market_drift * agent.reflexivity * max(0.1, aggression)
    adjusted_target -= market_drift * agent.contrarian * 0.45
    if abs(edge) > 0.08:
        adjusted_target += min(0.16, volatility * (0.9 if edge > 0 else -0.9))
    adjusted_target = max(0.02, min(0.98, adjusted_target))
    conviction = min(1.0, abs(adjusted_target - market_probability) * (0.9 + aggression) + confidence * 0.35)
    capital_fraction = min(0.55, 0.08 + conviction * 0.48 + max(0.0, volatility) * 0.6)
    spend_budget = max(4.0, agent.capital * capital_fraction)
    liquidity_scale = min(0.35, spend_budget / max(20.0, market.lmsr_b * 1.6))
    target = market_probability + (adjusted_target - market_probability) * min(1.0, confidence + liquidity_scale)
    return max(0.02, min(0.98, target)), spend_budget


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
        market_history: list[float] = [market.current_probability]
        for r in range(1, rounds + 1):
            p = probability(market.lmsr_b, market.q_yes, market.q_no)
            recent_market_probs = (market_history + [p])[-8:]
            thoughts = await asyncio.gather(*[_agent_think(provider, market, agent, p, r) for agent in agents])
            ranked = sorted(
                zip(agents, thoughts),
                key=lambda item: abs(item[1]["estimated_probability"] - p) * item[1]["confidence"] * (0.7 + item[1].get("aggression", 0.5)),
                reverse=True,
            )
            for agent, data in ranked:
                if not data.get("tradeable"):
                    logger.warning("Skipping synthetic trade for agent=%s market=%s round=%s", agent.id, market.id, r)
                    continue
                p = probability(market.lmsr_b, market.q_yes, market.q_no)
                target, spend_budget = _position_trade(
                    market=market,
                    market_probability=p,
                    estimated_probability=float(data["estimated_probability"]),
                    confidence=float(data["confidence"]),
                    aggression=float(data.get("aggression", agent.risk)),
                    agent=agent,
                    recent_market_probs=recent_market_probs,
                )
                qy, qn, spend = move_to_probability(market.lmsr_b, market.q_yes, market.q_no, target)
                spend = min(spend, agent.capital, spend_budget)
                if spend <= 0.01:
                    continue
                affordability = min(1.0, spend / max(spend_budget, 1e-6))
                if affordability < 0.999:
                    scaled_target = p + (target - p) * affordability
                    qy, qn, spend = move_to_probability(market.lmsr_b, market.q_yes, market.q_no, scaled_target)
                    target = scaled_target
                direction = 1.0 if target >= p else -1.0
                shares_delta = (abs(qy - market.q_yes) + abs(qn - market.q_no)) * direction
                market.q_yes = qy
                market.q_no = qn
                market.current_probability = probability(market.lmsr_b, market.q_yes, market.q_no)
                agent.capital -= spend
                market_history.append(market.current_probability)
                db_agent = await session.get(Agent, agent.id)
                if db_agent:
                    db_agent.capital = agent.capital
                    memory_events = list(db_agent.memory.get("events", []))[-24:]
                    stance_history = list(db_agent.memory.get("stance_history", []))[-12:]
                    memory_events.append(
                        {
                            "round": r,
                            "market_id": market.id,
                            "estimated_probability": data["estimated_probability"],
                            "post_probability": market.current_probability,
                            "confidence": data["confidence"],
                            "rationale": str(data["rationale"])[:220],
                        }
                    )
                    stance_history.append(
                        {
                            "round": r,
                            "target_probability": target,
                            "direction": "bullish" if direction > 0 else "bearish",
                            "confidence": data["confidence"],
                        }
                    )
                    db_agent.memory = {"events": memory_events, "stance_history": stance_history}
                    error = abs(float(data["estimated_probability"]) - market.current_probability)
                    db_agent.calibration_score = round(max(0.0, 1.0 - error), 3)
                    db_agent.reputation = round(min(0.99, max(0.01, db_agent.reputation * 0.92 + float(data["confidence"]) * 0.08)), 3)
                session.add(
                    Trade(
                        market_id=market.id,
                        agent_id=agent.id,
                        confidence=float(data["confidence"]),
                        estimated_probability=float(data["estimated_probability"]),
                        spend=spend,
                        shares_delta=shares_delta,
                        round_index=r,
                        pre_probability=p,
                        post_probability=market.current_probability,
                        rationale=" | ".join(
                            part
                            for part in [
                                str(data.get("thesis", "")).strip(),
                                str(data.get("rationale", "")).strip(),
                                f"Self-critique: {str(data.get('self_critique', '')).strip()}",
                            ]
                            if part
                        ),
                        research_history=data["sources"],
                        active_positions={
                            "confidence": data["confidence"],
                            "target_probability": target,
                            "direction": "bullish" if direction > 0 else "bearish",
                            "aggression": data.get("aggression", agent.risk),
                            "evidence_used": data.get("evidence_used", []),
                        },
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
                            "agent_title": agent.title,
                            "probability": market.current_probability,
                            "estimated_probability": data["estimated_probability"],
                            "confidence": data["confidence"],
                            "spend": spend,
                            "pre_probability": p,
                            "rationale": str(data["rationale"])[:220],
                            "shares_delta": shares_delta,
                            "direction": "bullish" if direction > 0 else "bearish",
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
