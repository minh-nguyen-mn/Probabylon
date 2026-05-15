from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from uuid import uuid4

import redis.asyncio as redis
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from app.api.admin_routes import admin_router
from app.api.auth_routes import auth_router
from app.api.routes import router
from app.core.auth import hash_password, utcnow_naive
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.models import AuditLog, User
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


ADMIN_SEED_USERS = (
    {
        "email": "admin@probabylon.ai",
        "username": "probabylon_admin",
        "name": "Probabylon Admin",
        "password": "Admin123!Secure",
    },
    {
        "email": "admin@gmail.com",
        "username": "admin",
        "name": "Primary Admin",
        "password": "admin",
    },
)


async def seed_admin_account() -> None:
    async with SessionLocal() as session:
        for admin_seed in ADMIN_SEED_USERS:
            password_hash = hash_password(admin_seed["password"])
            result = await session.execute(select(User).where(User.email == admin_seed["email"]))
            user = result.scalar_one_or_none()
            if user:
                user.username = admin_seed["username"]
                user.password_hash = password_hash
                user.name = admin_seed["name"]
                user.role = "admin"
                user.is_active = True
                user.updated_at = utcnow_naive()
            else:
                session.add(
                    User(
                        email=admin_seed["email"],
                        username=admin_seed["username"],
                        password_hash=password_hash,
                        name=admin_seed["name"],
                        role="admin",
                        is_active=True,
                    )
                )
            session.add(
                AuditLog(
                    user_id=None,
                    action="system.seed_admin",
                    resource_type="auth",
                    metadata_json={"email": admin_seed["email"], "username": admin_seed["username"]},
                )
            )
        await session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging(settings.log_level)
    await seed_admin_account()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health() -> dict:
    db_ok = False
    redis_ok = False
    db_error = None
    redis_error = None
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:
        db_error = str(exc)

    try:
        client = redis.from_url(settings.redis_url)
        redis_ok = bool(await client.ping())
        await client.close()
    except Exception as exc:
        redis_ok = False
        redis_error = str(exc)

    return {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "database": db_ok,
        "redis": redis_ok,
        "environment": settings.app_env,
        "errors": {
            "database": db_error,
            "redis": redis_error,
        },
    }


@app.websocket("/ws/markets")
async def market_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    pubsub_client = redis.from_url(settings.redis_url)
    pubsub = pubsub_client.pubsub()
    await pubsub.subscribe("probabylon.market.events")
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
            if message and message.get("data"):
                payload = message["data"].decode() if isinstance(message["data"], bytes) else message["data"]
                await websocket.send_text(payload)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)}))
    finally:
        await pubsub.unsubscribe("probabylon.market.events")
        await pubsub.close()
        await pubsub_client.close()
