from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import UserRead, UserUpdate

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])


def _user_read(u: User) -> UserRead:
    return UserRead(
        id=u.id,
        email=u.email,
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
        query = query.where(User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%"))
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
