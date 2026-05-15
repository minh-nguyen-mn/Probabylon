from __future__ import annotations

from urllib.parse import urlencode
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    STATE_COOKIE_NAME,
    build_google_authorize_url,
    clear_cookie,
    create_google_state_token,
    enforce_trusted_origin,
    ensure_user_preference,
    exchange_google_code,
    get_current_user,
    hash_password,
    issue_session,
    revoke_refresh_token,
    rotate_refresh_token,
    set_cookie,
    validate_state_cookie,
    verify_password,
)
from app.core.config import settings
from app.db.models import AuditLog, User
from app.db.session import get_db
from app.schemas.auth import (
    AuthStatus,
    GoogleAuthUrlResponse,
    PreferenceUpdate,
    TokenResponse,
    UserLogin,
    UserPreferenceRead,
    UserRead,
    UserRegister,
)

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


async def _status_payload(user: User, db: AsyncSession) -> AuthStatus:
    pref = await ensure_user_preference(user.id, db)
    return AuthStatus(
        user=_user_read(user),
        preference=UserPreferenceRead(language=pref.language, timezone=pref.timezone),
    )


async def _log_action(db: AsyncSession, action: str, user_id: str | None, metadata: dict) -> None:
    db.add(AuditLog(user_id=user_id, action=action, resource_type="auth", metadata_json=metadata))
    await db.commit()


def _make_token_response(access_token: str, user: User) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=_user_read(user),
    )


def _derive_username(email: str) -> str:
    base = email.split("@", 1)[0].lower().replace(".", "_").replace("-", "_")
    return "".join(ch for ch in base if ch.isalnum() or ch == "_")[:40] or f"user_{uuid4().hex[:8]}"


async def _unique_username(seed: str, db: AsyncSession) -> str:
    username = seed
    suffix = 1
    while True:
        result = await db.execute(select(User).where(func.lower(User.username) == username.lower()))
        if not result.scalar_one_or_none():
            return username
        suffix += 1
        username = f"{seed[:40-len(str(suffix))-1]}_{suffix}"


@auth_router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    enforce_trusted_origin(request)
    email = payload.email.strip().lower()
    username = payload.username.strip()
    existing = await db.execute(
        select(User).where(
            (func.lower(User.email) == email) | (func.lower(User.username) == username.lower())
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered")

    user = User(
        id=str(uuid4()),
        email=email,
        username=username,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        role="user",
        is_active=True,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered") from exc
    await db.refresh(user)
    await ensure_user_preference(user.id, db)
    access_token, _ = await issue_session(response, user, db, request=request)
    await _log_action(db, "auth.register", user.id, {"email": user.email})
    return _make_token_response(access_token, user)


@auth_router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    enforce_trusted_origin(request)
    identifier = payload.identifier.strip().lower()
    result = await db.execute(
        select(User).where(
            (func.lower(User.email) == identifier) | (func.lower(User.username) == identifier)
        )
    )
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token, _ = await issue_session(response, user, db, request=request)
    await _log_action(db, "auth.login", user.id, {"email": user.email})
    return _make_token_response(access_token, user)


@auth_router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    enforce_trusted_origin(request)
    await revoke_refresh_token(request.cookies.get(REFRESH_COOKIE_NAME), db)
    clear_cookie(response, ACCESS_COOKIE_NAME)
    clear_cookie(response, REFRESH_COOKIE_NAME)
    clear_cookie(response, STATE_COOKIE_NAME)
    return {"detail": "Logged out"}


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    enforce_trusted_origin(request)
    provided_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
    if not provided_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    user, access_token = await rotate_refresh_token(response, provided_refresh, db, request=request)
    await _log_action(db, "auth.refresh", user.id, {"email": user.email})
    return _make_token_response(access_token, user)


@auth_router.get("/me", response_model=AuthStatus)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AuthStatus:
    return await _status_payload(user, db)


@auth_router.patch("/preferences", response_model=AuthStatus)
async def update_preferences(
    payload: PreferenceUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthStatus:
    enforce_trusted_origin(request)
    pref = await ensure_user_preference(user.id, db)
    if payload.language is not None:
        pref.language = payload.language
    if payload.timezone is not None:
        pref.timezone = payload.timezone
    await db.commit()
    await db.refresh(pref)
    return await _status_payload(user, db)


@auth_router.get("/google", response_model=GoogleAuthUrlResponse)
async def google_auth_url(response: Response) -> GoogleAuthUrlResponse:
    state = create_google_state_token()
    set_cookie(response, STATE_COOKIE_NAME, state, settings.google_oauth_state_ttl_minutes * 60)
    return GoogleAuthUrlResponse(authorization_url=build_google_authorize_url(state))


@auth_router.get("/google/callback")
async def google_callback(code: str, state: str, request: Request, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    validate_state_cookie(request, state)
    google_profile = await exchange_google_code(code)
    email = (google_profile.get("email") or "").strip().lower()
    google_id = (google_profile.get("sub") or "").strip()
    name = (google_profile.get("name") or email.split("@", 1)[0]).strip()
    avatar_url = (google_profile.get("picture") or "").strip() or None

    if not email or not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account is missing required fields")

    result = await db.execute(select(User).where((User.google_id == google_id) | (func.lower(User.email) == email)))
    user = result.scalar_one_or_none()
    if user:
        user.google_id = google_id
        user.avatar_url = avatar_url or user.avatar_url
        if not user.name:
            user.name = name
    else:
        user = User(
            id=str(uuid4()),
            email=email,
            username=await _unique_username(_derive_username(email), db),
            password_hash=None,
            name=name,
            role="user",
            google_id=google_id,
            avatar_url=avatar_url,
            is_active=True,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    await ensure_user_preference(user.id, db)

    redirect = RedirectResponse(url=f"{str(settings.frontend_url).rstrip('/')}/auth/callback?{urlencode({'provider': 'google', 'status': 'success'})}")
    await issue_session(redirect, user, db, request=request)
    clear_cookie(redirect, STATE_COOKIE_NAME)
    await _log_action(db, "auth.google", user.id, {"email": user.email})
    return redirect
