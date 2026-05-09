from __future__ import annotations

from collections import defaultdict
import math
from statistics import pstdev

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Agent, Market, Trade
from app.db.session import get_db
from app.schemas.market import DashboardPayload, MarketCreate, MarketDetailPayload, MarketRead, SimulationStart
from app.services import enqueue_simulation, estimate_initial_probability, publish_market_event

router = APIRouter(prefix="/api", tags=["probabylon"])


@router.post("/markets", response_model=MarketRead)
async def create_market(payload: MarketCreate, db: AsyncSession = Depends(get_db)) -> Market:
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
        category=payload.category,
        initial_probability=initial_probability,
        current_probability=initial_probability,
        lmsr_b=liquidity_b,
        q_yes=q_yes,
        q_no=q_no,
        expires_at=payload.expires_at,
    )
    db.add(market)
    await db.commit()
    await db.refresh(market)
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
    result = await db.execute(select(Market).order_by(Market.created_at.desc()))
    return list(result.scalars().all())


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
    markets = list((await db.execute(select(Market).order_by(desc(Market.created_at)).limit(100))).scalars())
    recent_trades = list((await db.execute(select(Trade).order_by(desc(Trade.created_at)).limit(200))).scalars())
    agents = list((await db.execute(select(Agent).order_by(desc(Agent.capital)).limit(100))).scalars())

    market_trades: dict[str, list[Trade]] = defaultdict(list)
    for t in recent_trades:
        market_trades[t.market_id].append(t)

    market_rows = []
    for m in markets:
        t = market_trades.get(m.id, [])
        probs = [x.post_probability for x in t]
        momentum = (probs[0] - probs[-1]) if len(probs) > 1 else 0.0
        volatility = pstdev(probs) if len(probs) > 1 else 0.0
        volume = sum(x.spend for x in t)
        market_rows.append(
            {
                "id": m.id,
                "question": m.question,
                "category": m.category,
                "probability": m.current_probability,
                "momentum": momentum,
                "volatility": volatility,
                "volume": volume,
                "status": m.status,
                "expires_at": m.expires_at.isoformat(),
            }
        )

    return DashboardPayload(
        markets=market_rows,
        recent_trades=[
            {
                "id": t.id,
                "market_id": t.market_id,
                "agent_id": t.agent_id,
                "confidence": t.confidence,
                "estimated_probability": t.estimated_probability,
                "spend": t.spend,
                "pre_probability": t.pre_probability,
                "post_probability": t.post_probability,
                "rationale": t.rationale,
                "round_index": t.round_index,
                "created_at": t.created_at.isoformat(),
                "shares_delta": t.shares_delta,
                "direction": t.active_positions.get("direction") if t.active_positions else None,
            }
            for t in recent_trades
        ],
        active_agents=[
            {
                "id": a.id,
                "persona": a.persona,
                "capital": a.capital,
                "reputation": a.reputation,
                "calibration_score": a.calibration_score,
                "risk_profile": a.risk_profile,
            }
            for a in agents
        ],
    )


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
    probs = [t.post_probability for t in trades]
    history = [
        {
            "trade_id": t.id,
            "round_index": t.round_index,
            "post_probability": t.post_probability,
            "confidence": t.confidence,
            "agent_id": t.agent_id,
            "created_at": t.created_at.isoformat(),
        }
        for t in trades
    ]

    bins = [0, 0, 0, 0, 0]
    for t in trades[-300:]:
        idx = min(4, int(t.confidence * 5))
        bins[idx] += 1

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
            "volume": sum(t.spend for t in trades),
            "volatility": pstdev(probs) if len(probs) > 1 else 0.0,
        },
        probability_history=history,
        trades=[
            {
                "id": t.id,
                "agent_id": t.agent_id,
                "confidence": t.confidence,
                "estimated_probability": t.estimated_probability,
                "spend": t.spend,
                "shares_delta": t.shares_delta,
                "pre_probability": t.pre_probability,
                "post_probability": t.post_probability,
                "rationale": t.rationale,
                "research_history": t.research_history,
                "round_index": t.round_index,
                "created_at": t.created_at.isoformat(),
                "direction": t.active_positions.get("direction") if t.active_positions else None,
            }
            for t in trades[-500:]
        ],
        agents=[
            {
                "id": a.id,
                "persona": a.persona,
                "capital": a.capital,
                "reputation": a.reputation,
                "calibration_score": a.calibration_score,
                "risk_profile": a.risk_profile,
            }
            for a in agents
        ],
        confidence_distribution=[
            {"bucket": "0.0-0.2", "count": bins[0]},
            {"bucket": "0.2-0.4", "count": bins[1]},
            {"bucket": "0.4-0.6", "count": bins[2]},
            {"bucket": "0.6-0.8", "count": bins[3]},
            {"bucket": "0.8-1.0", "count": bins[4]},
        ],
    )
