from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import bcrypt
import httpx
from fastapi import Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import RefreshToken, User, UserPreference
from app.db.session import get_db

ACCESS_COOKIE_NAME = "probabylon_access"
REFRESH_COOKIE_NAME = "probabylon_refresh"
STATE_COOKIE_NAME = "probabylon_oauth_state"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_naive() -> datetime:
    return utcnow().replace(tzinfo=None)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _encode_token(payload: dict[str, Any], secret: str, ttl: timedelta) -> str:
    data = payload.copy()
    data["exp"] = utcnow() + ttl
    return jwt.encode(data, secret, algorithm=settings.jwt_algorithm)


def create_access_token(user: User) -> str:
    return _encode_token(
        {"sub": user.id, "role": user.role, "email": user.email, "type": "access"},
        settings.jwt_secret,
        timedelta(minutes=settings.access_token_ttl_minutes),
    )


def create_google_state_token() -> str:
    nonce = secrets.token_urlsafe(24)
    return _encode_token({"nonce": nonce, "type": "google_state"}, settings.jwt_secret, timedelta(minutes=settings.google_oauth_state_ttl_minutes))


def decode_token(token: str, secret: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def build_google_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_google_code(code: str) -> dict[str, Any]:
    payload = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.google_redirect_uri,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post("https://oauth2.googleapis.com/token", data=payload)
        if token_response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token exchange failed")
        token_data = token_response.json()
        userinfo_response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google userinfo lookup failed")
        return userinfo_response.json()


def set_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )


def clear_cookie(response: Response, key: str) -> None:
    response.delete_cookie(key=key, path="/", samesite=settings.cookie_samesite, secure=settings.cookie_secure)


async def issue_session(
    response: Response,
    user: User,
    db: AsyncSession,
    request: Request | None = None,
) -> tuple[str, str]:
    access_token = create_access_token(user)
    refresh_token = secrets.token_urlsafe(48)
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=utcnow_naive() + timedelta(days=settings.refresh_token_ttl_days),
        user_agent=request.headers.get("user-agent") if request else None,
        ip_address=request.client.host if request and request.client else None,
    )
    db.add(refresh_record)
    await db.commit()
    set_cookie(response, ACCESS_COOKIE_NAME, access_token, settings.access_token_ttl_minutes * 60)
    set_cookie(response, REFRESH_COOKIE_NAME, refresh_token, settings.refresh_token_ttl_days * 24 * 60 * 60)
    return access_token, refresh_token


async def rotate_refresh_token(
    response: Response,
    provided_token: str,
    db: AsyncSession,
    request: Request | None = None,
) -> tuple[User, str]:
    result = await db.execute(
        select(RefreshToken, User)
        .join(User, User.id == RefreshToken.user_id)
        .where(RefreshToken.token_hash == hash_token(provided_token))
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    refresh_record, user = row
    now = utcnow_naive()
    if refresh_record.revoked_at or refresh_record.expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    refresh_record.revoked_at = now
    refresh_record.rotated_at = now
    await db.flush()
    await issue_session(response, user, db, request=request)
    return user, create_access_token(user)


async def revoke_refresh_token(token: str | None, db: AsyncSession) -> None:
    if not token:
        return
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
    record = result.scalar_one_or_none()
    if record and not record.revoked_at:
        record.revoked_at = utcnow_naive()
        await db.commit()


def get_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return request.cookies.get(ACCESS_COOKIE_NAME)


async def ensure_user_preference(user_id: str, db: AsyncSession) -> UserPreference:
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    pref = result.scalar_one_or_none()
    if pref:
        return pref
    pref = UserPreference(user_id=user_id)
    db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token, settings.jwt_secret)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or deactivated")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def validate_state_cookie(request: Request, state: str) -> None:
    cookie_value = request.cookies.get(STATE_COOKIE_NAME)
    if not cookie_value or cookie_value != state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    payload = decode_token(state, settings.jwt_secret)
    if payload.get("type") != "google_state":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")


def enforce_trusted_origin(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if not origin:
        return
    if not any(origin.startswith(allowed) for allowed in settings.allowed_origins):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted request origin")
