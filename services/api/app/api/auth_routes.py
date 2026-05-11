from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_google_token,
    verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import GoogleAuth, TokenResponse, UserLogin, UserRead, UserRegister

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


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


@auth_router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where((User.email == payload.email) | (User.username == payload.username)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or Username already registered")
    user = User(
        id=str(uuid4()),
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name or payload.username,
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=_user_read(user))


@auth_router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=_user_read(user))


@auth_router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleAuth, db: AsyncSession = Depends(get_db)):
    google_data = await verify_google_token(payload.id_token)
    google_id = google_data.get("sub", "")
    email = google_data.get("email", "")
    name = google_data.get("name", email.split("@")[0])
    picture = google_data.get("picture", "")

    # Try to find existing user by google_id or email
    result = await db.execute(select(User).where((User.google_id == google_id) | (User.email == email)))
    user = result.scalar_one_or_none()

    if user:
        # Link google_id if not yet linked
        if not user.google_id:
            user.google_id = google_id
        if picture and not user.avatar_url:
            user.avatar_url = picture
        await db.commit()
        await db.refresh(user)
    else:
        # User doesn't exist. Check if we have registration info
        if not payload.username or not payload.password:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "NEED_REGISTRATION",
                    "email": email,
                    "name": name,
                    "picture": picture
                }
            )

        # Check if username already exists
        if payload.username:
            existing_username = await db.execute(select(User).where(User.username == payload.username))
            if existing_username.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

        user = User(
            id=str(uuid4()),
            email=email,
            username=payload.username,
            password_hash=hash_password(payload.password),
            name=payload.name or name,
            google_id=google_id,
            avatar_url=picture,
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=_user_read(user))


@auth_router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    return _user_read(user)
