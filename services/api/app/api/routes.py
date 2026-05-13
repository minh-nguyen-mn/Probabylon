from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
import json
import math
import re
from statistics import mean, pstdev
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db.models import Agent, ForecastQuery, Market, MarketProposal, Trade, User
from app.db.session import get_db
from app.schemas.market import (
    DashboardPayload,
    FeaturedMarketUpdate,
    ForecastAsk,
    MarketCreate,
    MarketDetailPayload,
    MarketProposalCreate,
    MarketProposalUpdate,
    MarketRead,
    SimulationStart,
)
from app.services import enqueue_simulation, estimate_initial_probability, publish_market_event

router = APIRouter(prefix="/api", tags=["probabylon"])

CATEGORY_TITLES = {
    "technology": "Technology",
    "finance": "Finance",
    "politics": "Politics",
    "science": "Science",
    "ai": "AI",
    "culture": "Culture",
    "sports": "Sports",
    "memes": "Memes",
    "philosophy": "Philosophy",
    "geopolitics": "Geopolitics",
    "society": "Society",
    "entertainment": "Entertainment",
    "absurdity": "Absurdity",
    "general": "General",
}


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-") or "general"


def _category_name(slug: str) -> str:
    return CATEGORY_TITLES.get(slug, slug.replace("-", " ").title())


def _risk_style(agent: Agent) -> str:
    risk_profile = agent.risk_profile or {}
    return (
        risk_profile.get("style")
        or risk_profile.get("worldview")
        or ("Contrarian" if (risk_profile.get("contrarian") or 0) >= 0.55 else "Adaptive")
    )


def _agent_summary(agent: Agent) -> dict:
    risk_profile = agent.risk_profile or {}
    return {
        "id": agent.id,
        "persona": agent.persona,
        "capital": agent.capital,
        "reputation": agent.reputation,
        "calibration_score": agent.calibration_score,
        "risk_profile": risk_profile,
        "archetype": _risk_style(agent),
        "conviction": min(0.99, max(0.05, 0.5 + (risk_profile.get("risk", 0.5) - 0.5) * 0.8)),
        "specialization": risk_profile.get("worldview") or "Cross-domain macro reasoning",
    }


def _trade_summary(trade: Trade) -> dict:
    return {
        "id": trade.id,
        "market_id": trade.market_id,
        "agent_id": trade.agent_id,
        "confidence": trade.confidence,
        "estimated_probability": trade.estimated_probability,
        "spend": trade.spend,
        "pre_probability": trade.pre_probability,
        "post_probability": trade.post_probability,
        "rationale": trade.rationale,
        "round_index": trade.round_index,
        "created_at": trade.created_at.isoformat(),
        "shares_delta": trade.shares_delta,
        "direction": trade.active_positions.get("direction") if trade.active_positions else None,
    }


def _narratives_for_market(market: Market, trades: list[Trade]) -> list[str]:
    text = " ".join([market.question, market.description] + [trade.rationale for trade in trades[-8:]])
    text = text.lower()
    rules = [
        ("ai", "AI capability optimism rising"),
        ("recession", "Macro slowdown concerns increasing"),
        ("bitcoin", "Crypto reflexivity remains elevated"),
        ("election", "Political uncertainty intensifying"),
        ("war", "Geopolitical risk premium expanding"),
        ("remote", "Workplace future still contested"),
        ("agi", "AGI timelines attracting polarized conviction"),
    ]
    narratives = [label for keyword, label in rules if keyword in text]
    if not narratives:
        narratives = [
            "Collective conviction remains fluid",
            "Agents are repricing around fresh evidence",
        ]
    return narratives[:3]


def _market_card(market: Market, trades: list[Trade]) -> dict:
    probabilities = [trade.post_probability for trade in trades]
    momentum = (probabilities[-1] - probabilities[0]) if len(probabilities) > 1 else 0.0
    volatility = pstdev(probabilities) if len(probabilities) > 1 else 0.0
    volume = sum(trade.spend for trade in trades)
    recent_agents = list(dict.fromkeys([trade.agent_id for trade in trades[-6:]]))
    confidence = min(0.99, max(0.05, 1.0 - min(0.65, volatility * 3.5)))
    return {
        "id": market.id,
        "question": market.question,
        "description": market.description,
        "category": market.category,
        "probability": market.current_probability,
        "momentum": momentum,
        "volatility": volatility,
        "volume": volume,
        "status": market.status,
        "expires_at": market.expires_at.isoformat(),
        "is_featured": market.is_featured,
        "is_pinned": market.is_pinned,
        "source": market.source,
        "confidence": confidence,
        "activity": len(trades),
        "participating_agents": recent_agents,
        "narratives": _narratives_for_market(market, trades),
    }


async def _load_platform_data(db: AsyncSession) -> tuple[list[Market], list[Trade], list[Agent], list[User], list[MarketProposal], list[ForecastQuery]]:
    markets = list((await db.execute(select(Market).order_by(desc(Market.created_at)).limit(300))).scalars())
    trades = list((await db.execute(select(Trade).order_by(desc(Trade.created_at)).limit(600))).scalars())
    agents = list((await db.execute(select(Agent).order_by(desc(Agent.capital)).limit(200))).scalars())
    users = list((await db.execute(select(User).order_by(desc(User.created_at)).limit(200))).scalars())
    proposals = list((await db.execute(select(MarketProposal).order_by(desc(MarketProposal.created_at)).limit(200))).scalars())
    forecasts = list((await db.execute(select(ForecastQuery).order_by(desc(ForecastQuery.created_at)).limit(200))).scalars())
    return markets, trades, agents, users, proposals, forecasts


def _group_trades_by_market(trades: list[Trade]) -> dict[str, list[Trade]]:
    grouped: dict[str, list[Trade]] = defaultdict(list)
    for trade in reversed(trades):
        grouped[trade.market_id].append(trade)
    return grouped


def _dashboard_payload(markets: list[Market], trades: list[Trade], agents: list[Agent]) -> DashboardPayload:
    grouped = _group_trades_by_market(trades)
    return DashboardPayload(
        markets=[_market_card(market, grouped.get(market.id, [])) for market in markets],
        recent_trades=[_trade_summary(trade) for trade in trades[:200]],
        active_agents=[_agent_summary(agent) for agent in agents[:100]],
    )


def _top_users(users: list[User], proposals: list[MarketProposal], forecasts: list[ForecastQuery]) -> list[dict]:
    proposal_count = Counter(proposal.user_id for proposal in proposals if proposal.user_id)
    forecast_count = Counter(forecast.user_id for forecast in forecasts if forecast.user_id)
    result = []
    for user in users:
        participation = proposal_count.get(user.id, 0) + forecast_count.get(user.id, 0)
        result.append(
            {
                "id": user.id,
                "name": user.name or user.username or user.email,
                "email": user.email,
                "reputation": round(0.45 + min(0.5, participation * 0.03), 2),
                "badges": ["Forecaster"] if participation else [],
                "submitted_markets": proposal_count.get(user.id, 0),
                "forecast_count": forecast_count.get(user.id, 0),
            }
        )
    return sorted(result, key=lambda item: (item["reputation"], item["forecast_count"]), reverse=True)[:10]


def _category_payload(markets: list[dict], trades_by_market: dict[str, list[Trade]]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for market in markets:
        grouped[_slugify(market["category"])].append(market)
    categories = []
    for slug, rows in grouped.items():
        avg_probability = mean(row["probability"] for row in rows) if rows else 0.5
        sentiment = "Bullish" if avg_probability >= 0.55 else "Bearish" if avg_probability <= 0.45 else "Balanced"
        categories.append(
            {
                "slug": slug,
                "name": _category_name(slug),
                "market_count": len(rows),
                "avg_probability": avg_probability,
                "sentiment": sentiment,
                "volume": sum(row["volume"] for row in rows),
                "volatility": mean(row["volatility"] for row in rows) if rows else 0.0,
                "featured_markets": rows[:3],
            }
        )
    return sorted(categories, key=lambda item: (item["volume"], item["market_count"]), reverse=True)


def _market_health(markets: list[dict], agents: list[Agent], trades: list[Trade]) -> dict:
    avg_volatility = mean([market["volatility"] for market in markets]) if markets else 0.0
    avg_confidence = mean([market["confidence"] for market in markets]) if markets else 0.5
    calibration = mean([agent.calibration_score for agent in agents]) if agents else 0.5
    return {
        "uncertainty_index": round(avg_volatility * 100, 2),
        "consensus_stability": round((1 - min(0.8, avg_volatility * 4)) * 100, 1),
        "calibration_quality": round(calibration * 100, 1),
        "market_sentiment": round(mean([market["probability"] for market in markets]) * 100, 1) if markets else 50.0,
        "live_simulations": len([market for market in markets if market["status"] == "running"]),
        "total_predictions": len(trades),
        "active_agents": len(agents),
    }


async def _forecast_result(question: str, category: str, context: str, markets: list[Market], agents: list[Agent]) -> dict:
    base_probability = await estimate_initial_probability(question, context, f"Binary forecast for category {category}")
    related_markets = []
    keywords = set(re.findall(r"[a-zA-Z]{4,}", f"{question} {context}".lower()))
    for market in markets:
        haystack = f"{market.question} {market.description} {market.category}".lower()
        score = sum(1 for keyword in keywords if keyword in haystack)
        if score:
            related_markets.append((score, market))
    related_markets = [market for _, market in sorted(related_markets, key=lambda item: item[0], reverse=True)[:4]]
    related_ids = [market.id for market in related_markets]
    disagreement = min(0.42, 0.12 + abs(base_probability - 0.5) * 0.35 + (0.04 if "ai" in category.lower() else 0.1))
    confidence = min(0.94, max(0.18, 1.0 - disagreement))
    drivers = [
        "Base rates remain uncertain and depend on framing.",
        "Recent market analogs suggest ongoing repricing pressure.",
        "Agent confidence rises when evidence is concrete and measurable.",
    ]
    evidence = [
        {
            "title": market.question,
            "snippet": market.description[:180] or "Related public market on the platform.",
            "market_id": market.id,
        }
        for market in related_markets
    ]
    agent_views = []
    for index, agent in enumerate(agents[:4]):
        offset = (-0.08 + index * 0.05)
        agent_probability = min(0.95, max(0.05, base_probability + offset))
        agent_views.append(
            {
                "agent_id": agent.id,
                "persona": agent.persona,
                "probability": round(agent_probability, 3),
                "stance": "bullish" if agent_probability >= 0.5 else "bearish",
                "summary": _risk_style(agent),
            }
        )
    return {
        "probability": round(base_probability, 3),
        "confidence": round(confidence, 3),
        "summary": "The agent collective sees a plausible but contested path, with probability shaped by comparable market analogs and category-specific uncertainty.",
        "key_uncertainty_drivers": drivers,
        "disagreement_summary": "Agents are directionally aligned but differ on timing, catalysts, and evidence quality.",
        "supporting_evidence": evidence,
        "related_market_ids": related_ids,
        "agent_views": agent_views,
    }


@router.post("/markets", response_model=MarketRead)
async def create_market(
    payload: MarketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Market:
    initial_probability = payload.initial_probability
    if initial_probability is None:
        initial_probability = await estimate_initial_probability(
            question=payload.question,
            description=payload.description,
            resolution_criteria=payload.resolution_criteria,
        )
    liquidity_b = payload.lmsr_b or 48.0
    rounds = payload.rounds or 10
    max_agents = payload.max_agents or 10
    p0 = max(1e-6, min(1.0 - 1e-6, initial_probability))
    q_no = 0.0
    q_yes = liquidity_b * math.log(p0 / (1.0 - p0))
    market = Market(
        question=payload.question,
        description=payload.description,
        resolution_criteria=payload.resolution_criteria,
        category=_slugify(payload.category),
        initial_probability=initial_probability,
        current_probability=initial_probability,
        lmsr_b=liquidity_b,
        q_yes=q_yes,
        q_no=q_no,
        expires_at=payload.expires_at,
        source="admin" if user.role == "admin" else "community",
        created_by_user_id=user.id,
        status="open" if user.role == "admin" else "pending_review",
    )
    db.add(market)
    await db.commit()
    await db.refresh(market)
    if user.role == "admin":
        task_id = enqueue_simulation(market_id=market.id, rounds=rounds, max_agents=max_agents)
        await publish_market_event(
            {
                "type": "market_created",
                "market_id": market.id,
                "question": market.question,
                "category": market.category,
                "probability": market.current_probability,
                "task_id": task_id,
                "status": market.status,
                "expires_at": market.expires_at.isoformat(),
            }
        )
    return market


@router.get("/markets", response_model=list[MarketRead])
async def list_markets(db: AsyncSession = Depends(get_db)) -> list[Market]:
    result = await db.execute(
        select(Market).where(Market.status.in_(["open", "running", "resolved", "archived"])).order_by(Market.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/markets/explore")
async def explore_markets(
    search: str = "",
    sort: str = "trending",
    category: str = "",
    db: AsyncSession = Depends(get_db),
) -> dict:
    markets, trades, agents, users, proposals, forecasts = await _load_platform_data(db)
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    if category:
        category_slug = _slugify(category)
        cards = [card for card in cards if _slugify(card["category"]) == category_slug]
    if search:
        needle = search.lower().strip()
        cards = [card for card in cards if needle in card["question"].lower() or needle in card["description"].lower()]

    sorters = {
        "newest": lambda card: card["expires_at"],
        "highest_volume": lambda card: card["volume"],
        "highest_volatility": lambda card: card["volatility"],
        "ending_soon": lambda card: card["expires_at"],
        "controversial": lambda card: abs(card["probability"] - 0.5) * -1 + card["volatility"],
        "resolved": lambda card: card["status"] == "resolved",
        "trending": lambda card: abs(card["momentum"]) + card["volume"] / 50,
    }
    reverse = sort not in {"ending_soon", "newest"}
    cards = sorted(cards, key=sorters.get(sort, sorters["trending"]), reverse=reverse)

    return {
        "markets": cards,
        "categories": _category_payload(cards, grouped),
        "stats": _market_health(cards, agents, trades),
        "watchlist": cards[:4],
        "bookmarks": cards[:4],
        "top_users": _top_users(users, proposals, forecasts),
    }


@router.post("/simulations/start")
async def start_simulation(payload: SimulationStart, db: AsyncSession = Depends(get_db)) -> dict:
    market = await db.get(Market, payload.market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    task_id = enqueue_simulation(market_id=payload.market_id, rounds=payload.rounds, max_agents=payload.max_agents)
    await publish_market_event(
        {
            "type": "simulation_started",
            "market_id": payload.market_id,
            "task_id": task_id,
            "rounds": payload.rounds,
            "max_agents": payload.max_agents,
        }
    )
    return {"task_id": task_id, "status": "queued"}


@router.get("/dashboard", response_model=DashboardPayload)
async def dashboard(db: AsyncSession = Depends(get_db)) -> DashboardPayload:
    markets, trades, agents, *_ = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    return _dashboard_payload(public_markets, trades, agents)


@router.get("/home")
async def home_snapshot(db: AsyncSession = Depends(get_db)) -> dict:
    markets, trades, agents, users, proposals, forecasts = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in public_markets]
    cards = sorted(cards, key=lambda card: (card["is_pinned"], card["is_featured"], card["volume"]), reverse=True)
    categories = _category_payload(cards, grouped)
    emerging_narratives = list(dict.fromkeys([n for card in cards[:12] for n in card["narratives"]]))[:6]
    volatility_heatmap = [
        {
            "category": item["name"],
            "volatility": round(item["volatility"], 3),
            "volume": round(item["volume"], 2),
        }
        for item in categories[:8]
    ]
    return {
        "featured_markets": [card for card in cards if card["is_featured"]][:6] or cards[:6],
        "trending_markets": sorted(cards, key=lambda card: abs(card["momentum"]) + card["volume"] / 50, reverse=True)[:8],
        "probability_movers": sorted(cards, key=lambda card: abs(card["momentum"]), reverse=True)[:6],
        "live_activity": [_trade_summary(trade) for trade in trades[:20]],
        "categories": categories,
        "top_agents": [_agent_summary(agent) for agent in agents[:8]],
        "top_users": _top_users(users, proposals, forecasts),
        "volatility_heatmap": volatility_heatmap,
        "emerging_narratives": emerging_narratives,
        "system_stats": {
            "total_markets": len(public_markets),
            "active_markets": len([market for market in cards if market["status"] in {"open", "running"}]),
            "resolved_markets": len([market for market in cards if market["status"] == "resolved"]),
            "total_volume": round(sum(card["volume"] for card in cards), 2),
            "average_volatility": round(mean([card["volatility"] for card in cards]) if cards else 0.0, 3),
            "total_trades": len(trades),
            "active_agents": len(agents),
            "live_simulations": len([market for market in cards if market["status"] == "running"]),
            "pending_submissions": len([proposal for proposal in proposals if proposal.status == "pending_review"]),
        },
        "sentiment_overview": _market_health(cards, agents, trades),
        "recent_forecasts": [
            {
                "id": forecast.id,
                "question": forecast.question,
                "category": forecast.category,
                "probability": forecast.probability,
                "confidence": forecast.confidence,
                "created_at": forecast.created_at.isoformat(),
            }
            for forecast in forecasts[:6]
        ],
    }


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)) -> dict:
    markets, trades, agents, *_ = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in public_markets]
    return {"categories": _category_payload(cards, grouped)}


@router.get("/categories/{slug}")
async def category_detail(slug: str, db: AsyncSession = Depends(get_db)) -> dict:
    markets, trades, agents, *_ = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in public_markets]
    category_cards = [card for card in cards if _slugify(card["category"]) == slug]
    if not category_cards:
        raise HTTPException(status_code=404, detail="Category not found")
    top_agents = sorted(
        [_agent_summary(agent) for agent in agents],
        key=lambda item: (item["calibration_score"], item["capital"]),
        reverse=True,
    )[:6]
    return {
        "category": {
            "slug": slug,
            "name": _category_name(slug),
            "market_count": len(category_cards),
            "avg_probability": mean([card["probability"] for card in category_cards]),
            "volume": sum(card["volume"] for card in category_cards),
            "volatility": mean([card["volatility"] for card in category_cards]),
            "sentiment": "Bullish" if mean([card["probability"] for card in category_cards]) >= 0.55 else "Balanced",
            "narratives": list(dict.fromkeys([n for card in category_cards for n in card["narratives"]]))[:6],
        },
        "markets": category_cards[:18],
        "top_agents": top_agents,
        "activity": [_trade_summary(trade) for trade in trades[:12]],
    }


@router.get("/agents")
async def list_agents(db: AsyncSession = Depends(get_db)) -> dict:
    agents = list((await db.execute(select(Agent).order_by(desc(Agent.capital)).limit(200))).scalars())
    rows = [_agent_summary(agent) for agent in agents]
    return {
        "agents": rows,
        "leaderboards": {
            "accuracy": sorted(rows, key=lambda item: item["calibration_score"], reverse=True)[:8],
            "profitability": sorted(rows, key=lambda item: item["capital"], reverse=True)[:8],
            "conviction": sorted(rows, key=lambda item: item["conviction"], reverse=True)[:8],
            "contrarian": sorted(rows, key=lambda item: item["risk_profile"].get("contrarian", 0), reverse=True)[:8],
            "activity": rows[:8],
        },
    }


@router.get("/insights")
async def insights_snapshot(db: AsyncSession = Depends(get_db)) -> dict:
    markets, trades, agents, users, proposals, forecasts = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in public_markets]
    health = _market_health(cards, agents, trades)
    disagreement_clusters = sorted(cards, key=lambda card: card["volatility"], reverse=True)[:6]
    return {
        "market_health": health,
        "disagreement_clusters": disagreement_clusters,
        "probability_shifts": sorted(cards, key=lambda card: abs(card["momentum"]), reverse=True)[:8],
        "volatility_events": sorted(cards, key=lambda card: card["volatility"], reverse=True)[:8],
        "collective_intelligence_metrics": {
            "consensus_stability": health["consensus_stability"],
            "calibration_quality": health["calibration_quality"],
            "agent_ecosystem_health": round(mean([agent.reputation for agent in agents]) * 100, 1) if agents else 50.0,
            "submission_pressure": len([proposal for proposal in proposals if proposal.status == "pending_review"]),
        },
        "recent_forecasts": [
            {
                "question": forecast.question,
                "probability": forecast.probability,
                "confidence": forecast.confidence,
                "category": forecast.category,
            }
            for forecast in forecasts[:10]
        ],
    }


@router.get("/trends")
async def trends_snapshot(db: AsyncSession = Depends(get_db)) -> dict:
    markets, trades, agents, *_ = await _load_platform_data(db)
    public_markets = [market for market in markets if market.status in {"open", "running", "resolved", "archived"}]
    grouped = _group_trades_by_market(trades)
    cards = [_market_card(market, grouped.get(market.id, [])) for market in public_markets]
    categories = _category_payload(cards, grouped)
    beliefs = []
    for category in categories[:6]:
        direction = "rising" if category["avg_probability"] >= 0.55 else "softening" if category["avg_probability"] <= 0.45 else "mixed"
        beliefs.append(
            {
                "headline": f"{category['name']} conviction {direction}",
                "summary": f"The ecosystem is pricing {category['name'].lower()} markets at {category['avg_probability'] * 100:.1f}% on average.",
                "category": category["name"],
            }
        )
    return {
        "beliefs": beliefs,
        "trending_markets": sorted(cards, key=lambda card: abs(card["momentum"]) + card["volume"] / 50, reverse=True)[:10],
        "sentiment_map": categories[:8],
    }


@router.post("/forecasts/ask")
async def ask_forecast(
    payload: ForecastAsk,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    markets, _, agents, _, _, _ = await _load_platform_data(db)
    result = await _forecast_result(payload.question, _slugify(payload.category), payload.context, markets, agents)
    query = ForecastQuery(
        user_id=user.id,
        question=payload.question,
        category=_slugify(payload.category),
        probability=result["probability"],
        confidence=result["confidence"],
        summary=result["summary"],
        key_uncertainty_drivers=result["key_uncertainty_drivers"],
        disagreement_summary=result["disagreement_summary"],
        supporting_evidence=result["supporting_evidence"],
        related_market_ids=result["related_market_ids"],
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)
    result["id"] = query.id
    result["related_markets"] = [
        _market_card(market, [])
        for market in markets
        if market.id in result["related_market_ids"]
    ][:4]
    return result


@router.post("/market-proposals")
async def submit_market_proposal(
    payload: MarketProposalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    proposal = MarketProposal(
        user_id=user.id,
        question=payload.question,
        description=payload.description,
        resolution_criteria=payload.resolution_criteria,
        category=_slugify(payload.category),
        expires_at=payload.expires_at,
        status="pending_review",
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return {
        "id": proposal.id,
        "status": proposal.status,
        "message": "Market proposal submitted for moderation review.",
    }


@router.get("/market-proposals/mine")
async def my_market_proposals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    proposals = list(
        (
            await db.execute(
                select(MarketProposal).where(MarketProposal.user_id == user.id).order_by(desc(MarketProposal.created_at))
            )
        ).scalars()
    )
    return {
        "proposals": [
            {
                "id": proposal.id,
                "question": proposal.question,
                "description": proposal.description,
                "category": proposal.category,
                "status": proposal.status,
                "moderation_notes": proposal.moderation_notes,
                "created_at": proposal.created_at.isoformat(),
                "expires_at": proposal.expires_at.isoformat(),
            }
            for proposal in proposals
        ]
    }


@router.get("/profile/me")
async def my_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    proposals = list(
        (
            await db.execute(
                select(MarketProposal).where(MarketProposal.user_id == user.id).order_by(desc(MarketProposal.created_at))
            )
        ).scalars()
    )
    forecasts = list(
        (
            await db.execute(
                select(ForecastQuery).where(ForecastQuery.user_id == user.id).order_by(desc(ForecastQuery.created_at))
            )
        ).scalars()
    )
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "reputation": round(0.55 + len(proposals) * 0.03 + len(forecasts) * 0.01, 2),
            "badges": ["Admin"] if user.role == "admin" else ["Forecaster"],
        },
        "metrics": {
            "submitted_markets": len(proposals),
            "private_forecasts": len(forecasts),
            "watchlist_count": min(8, len(proposals) + len(forecasts)),
            "accuracy_score": round(0.58 + min(0.22, len(forecasts) * 0.01), 2),
            "leaderboard_position": 1 if user.role == "admin" else 7,
        },
        "submitted_markets": [
            {
                "id": proposal.id,
                "question": proposal.question,
                "status": proposal.status,
                "category": proposal.category,
                "created_at": proposal.created_at.isoformat(),
            }
            for proposal in proposals[:8]
        ],
        "forecast_history": [
            {
                "id": forecast.id,
                "question": forecast.question,
                "category": forecast.category,
                "probability": forecast.probability,
                "confidence": forecast.confidence,
                "created_at": forecast.created_at.isoformat(),
            }
            for forecast in forecasts[:8]
        ],
    }


@router.patch("/markets/{market_id}/feature")
async def feature_market(
    market_id: str,
    payload: FeaturedMarketUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    market = await db.get(Market, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if payload.is_featured is not None:
        market.is_featured = payload.is_featured
    if payload.is_pinned is not None:
        market.is_pinned = payload.is_pinned
    await db.commit()
    return {"detail": "Market updated"}


@router.get("/markets/{market_id}", response_model=MarketDetailPayload)
async def market_detail(market_id: str, db: AsyncSession = Depends(get_db)) -> MarketDetailPayload:
    market = await db.get(Market, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    trades = list(
        (
            await db.execute(
                select(Trade).where(Trade.market_id == market_id).order_by(Trade.created_at.asc()).limit(5000)
            )
        ).scalars()
    )
    agents = list((await db.execute(select(Agent).order_by(desc(Agent.capital)).limit(300))).scalars())
    all_markets = list((await db.execute(select(Market).order_by(desc(Market.created_at)).limit(80))).scalars())
    all_recent_trades = list((await db.execute(select(Trade).order_by(desc(Trade.created_at)).limit(1200))).scalars())
    probs = [trade.post_probability for trade in trades]
    history = [
        {
            "trade_id": trade.id,
            "round_index": trade.round_index,
            "post_probability": trade.post_probability,
            "confidence": trade.confidence,
            "agent_id": trade.agent_id,
            "created_at": trade.created_at.isoformat(),
        }
        for trade in trades
    ]

    bins = [0, 0, 0, 0, 0]
    for trade in trades[-300:]:
        idx = min(4, int(trade.confidence * 5))
        bins[idx] += 1

    grouped_all_trades = _group_trades_by_market(all_recent_trades)
    related_markets = [
        _market_card(candidate, grouped_all_trades.get(candidate.id, []))
        for candidate in all_markets
        if candidate.id != market.id and (_slugify(candidate.category) == _slugify(market.category))
    ][:6]
    agent_map = {agent.id: agent for agent in agents}
    top_agents = []
    for agent_id, count in Counter(trade.agent_id for trade in trades).most_common(6):
        agent = agent_map.get(agent_id)
        if not agent:
            continue
        agent_summary = _agent_summary(agent)
        top_agents.append(
            {
                **agent_summary,
                "activity_count": count,
                "average_confidence": round(
                    mean([trade.confidence for trade in trades if trade.agent_id == agent_id]),
                    3,
                ),
            }
        )
    evidence_sources = []
    for trade in reversed(trades[-12:]):
        for item in (trade.research_history or [])[:2]:
            evidence_sources.append(
                {
                    "title": item.get("title") or item.get("source") or "Research note",
                    "snippet": item.get("snippet") or item.get("page_summary") or item.get("url") or "",
                }
            )
    if not evidence_sources:
        evidence_sources = [
            {
                "title": "Collective trade rationale",
                "snippet": trade.rationale or "Recent market reasoning from participating agents."
            }
            for trade in trades[-3:]
        ]
    timeline_replay = [
        {
            "label": f"Round {trade.round_index}",
            "probability": trade.post_probability,
            "summary": trade.rationale[:160] or "Agents repriced the market on new reasoning.",
            "created_at": trade.created_at.isoformat(),
        }
        for trade in trades[-8:]
    ]
    market_history = [
        {
            "timestamp": point["created_at"],
            "probability": point["post_probability"],
            "confidence": point["confidence"],
        }
        for point in history[-40:]
    ]

    return MarketDetailPayload(
        market={
            "id": market.id,
            "question": market.question,
            "description": market.description,
            "category": market.category,
            "resolution_criteria": market.resolution_criteria,
            "probability": market.current_probability,
            "status": market.status,
            "expires_at": market.expires_at.isoformat(),
            "volume": sum(trade.spend for trade in trades),
            "volatility": pstdev(probs) if len(probs) > 1 else 0.0,
            "confidence": min(0.99, max(0.05, 1.0 - min(0.65, (pstdev(probs) if len(probs) > 1 else 0.0) * 3.5))),
            "narratives": _narratives_for_market(market, trades),
            "source": market.source,
            "is_featured": market.is_featured,
            "is_pinned": market.is_pinned,
        },
        probability_history=history,
        trades=[
            {
                "id": trade.id,
                "agent_id": trade.agent_id,
                "confidence": trade.confidence,
                "estimated_probability": trade.estimated_probability,
                "spend": trade.spend,
                "shares_delta": trade.shares_delta,
                "pre_probability": trade.pre_probability,
                "post_probability": trade.post_probability,
                "rationale": trade.rationale,
                "research_history": trade.research_history,
                "round_index": trade.round_index,
                "created_at": trade.created_at.isoformat(),
                "direction": trade.active_positions.get("direction") if trade.active_positions else None,
            }
            for trade in trades[-500:]
        ],
        agents=[_agent_summary(agent) for agent in agents],
        confidence_distribution=[
            {"bucket": "0.0-0.2", "count": bins[0]},
            {"bucket": "0.2-0.4", "count": bins[1]},
            {"bucket": "0.4-0.6", "count": bins[2]},
            {"bucket": "0.6-0.8", "count": bins[3]},
            {"bucket": "0.8-1.0", "count": bins[4]},
        ],
        related_markets=related_markets,
        top_agents=top_agents,
        evidence_sources=evidence_sources[:8],
        timeline_replay=timeline_replay,
        market_history=market_history,
        sentiment_overview={
            "confidence_shift": round((history[-1]["post_probability"] - history[0]["post_probability"]) if len(history) > 1 else 0.0, 3),
            "activity_level": len(trades),
            "bullish_share": round(
                len([trade for trade in trades if (trade.active_positions or {}).get("direction") == "bullish"]) / max(1, len(trades)),
                3,
            ),
            "disagreement_score": round(pstdev(probs), 3) if len(probs) > 1 else 0.0,
        },
    )
