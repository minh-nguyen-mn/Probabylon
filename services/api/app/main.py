from __future__ import annotations

import asyncio
import json

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import router
from app.api.auth_routes import auth_router
from app.api.admin_routes import admin_router
from app.core.config import settings
from app.db.session import engine

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.on_event("startup")
async def ensure_runtime_schema() -> None:
    statements = [
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "UPDATE markets SET expires_at = COALESCE(expires_at, NOW() + INTERVAL '30 days')",
        "ALTER TABLE markets ALTER COLUMN expires_at SET NOT NULL",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS estimated_probability DOUBLE PRECISION DEFAULT 0.5",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS shares_delta DOUBLE PRECISION DEFAULT 0.0",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS round_index INTEGER DEFAULT 1",
    ]
    async with engine.begin() as conn:
        for statement in statements:
            await conn.execute(text(statement))


@app.on_event("startup")
async def seed_admin_password() -> None:
    """Fix the placeholder password hash for the default admin user."""
    from app.core.auth import hash_password

    async with engine.begin() as conn:
        row = await conn.execute(
            text("SELECT id, password_hash FROM users WHERE email = 'admin@probabylon.local'")
        )
        admin = row.mappings().first()
        if admin and admin["password_hash"] and "placeholder" in admin["password_hash"]:
            real_hash = hash_password("admin123")
            await conn.execute(
                text("UPDATE users SET password_hash = :h WHERE id = :uid"),
                {"h": real_hash, "uid": admin["id"]},
            )


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


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
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        await pubsub.unsubscribe("probabylon.market.events")
        await pubsub.close()
        await pubsub_client.close()
    except Exception as exc:
        await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)}))
