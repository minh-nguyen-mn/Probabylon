from __future__ import annotations

import math
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.db.models import ForecastQuery, Market, MarketProposal, User
from app.db.session import get_db
from app.schemas.auth import UserRead, UserUpdate
from app.schemas.market import MarketProposalUpdate
from app.services import enqueue_simulation, estimate_initial_probability, publish_market_event

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


def _user_read(u: User) -> UserRead:
    return UserRead(
        id=u.id,
        email=u.email,
        username=u.username,
        name=u.name,
        role=u.role,
        avatar_url=u.avatar_url,
        is_active=u.is_active,
        google_id=u.google_id,
        created_at=u.created_at.isoformat(),
        updated_at=u.updated_at.isoformat(),
    )


@admin_router.get("/users", response_model=list[UserRead])
async def list_users(
    search: str = "",
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%") | User.username.ilike(f"%{search}%")
        )
    result = await db.execute(query.limit(200))
    return [_user_read(u) for u in result.scalars()]


@admin_router.patch("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.name is not None:
        user.name = payload.name
    if payload.role is not None:
        if user.role == "admin" and payload.role != "admin":
            admin_count = await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))
            if admin_count.scalar_one() <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot demote the last admin")
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return _user_read(user)


@admin_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == "admin":
        # Prevent deleting the last admin
        admin_count = await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))
        if admin_count.scalar_one() <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the last admin")
    await db.delete(user)
    await db.commit()
    return {"detail": "User deleted"}


@admin_router.get("/analytics")
async def admin_analytics(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    admin_count = (await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))).scalar_one()
    market_count = (await db.execute(select(func.count()).select_from(Market))).scalar_one()
    proposal_count = (await db.execute(select(func.count()).select_from(MarketProposal))).scalar_one()
    forecast_count = (await db.execute(select(func.count()).select_from(ForecastQuery))).scalar_one()
    return {
        "users": users_count,
        "admins": admin_count,
        "markets": market_count,
        "proposals": proposal_count,
        "forecasts": forecast_count,
    }


@admin_router.get("/proposals")
async def list_proposals(
    status_filter: str = "",
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(MarketProposal).order_by(MarketProposal.created_at.desc())
    if status_filter:
        query = query.where(MarketProposal.status == status_filter)
    proposals = list((await db.execute(query.limit(300))).scalars())
    return [
        {
            "id": proposal.id,
            "user_id": proposal.user_id,
            "question": proposal.question,
            "description": proposal.description,
            "resolution_criteria": proposal.resolution_criteria,
            "category": proposal.category,
            "status": proposal.status,
            "moderation_notes": proposal.moderation_notes,
            "duplicate_of_market_id": proposal.duplicate_of_market_id,
            "expires_at": proposal.expires_at.isoformat(),
            "created_at": proposal.created_at.isoformat(),
        }
        for proposal in proposals
    ]


@admin_router.patch("/proposals/{proposal_id}")
async def moderate_proposal(
    proposal_id: str,
    payload: MarketProposalUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    proposal = await db.get(MarketProposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    if payload.category is not None:
        proposal.category = payload.category
    if payload.moderation_notes is not None:
        proposal.moderation_notes = payload.moderation_notes
    if payload.duplicate_of_market_id is not None:
        proposal.duplicate_of_market_id = payload.duplicate_of_market_id

    if payload.status == "approved":
        initial_probability = await estimate_initial_probability(
            proposal.question,
            proposal.description,
            proposal.resolution_criteria,
        )
        p0 = max(1e-6, min(1.0 - 1e-6, initial_probability))
        market = Market(
            id=str(uuid4()),
            question=proposal.question,
            description=proposal.description,
            resolution_criteria=proposal.resolution_criteria,
            category=proposal.category,
            initial_probability=initial_probability,
            current_probability=initial_probability,
            lmsr_b=48.0,
            q_yes=48.0 * math.log(p0 / (1.0 - p0)),
            q_no=0.0,
            expires_at=proposal.expires_at,
            status="open",
            source="community",
            created_by_user_id=proposal.user_id,
        )
        db.add(market)
        proposal.status = "approved"
        await db.commit()
        await db.refresh(market)
        task_id = enqueue_simulation(market_id=market.id, rounds=10, max_agents=10)
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
        return {"detail": "Proposal approved", "market_id": market.id}

    if payload.status is not None:
        proposal.status = payload.status

    await db.commit()
    return {"detail": "Proposal updated"}
