from __future__ import annotations

import asyncio
import json
from uuid import uuid4

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
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'admin'",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(36)",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false",
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false",
        "UPDATE markets SET expires_at = COALESCE(expires_at, NOW() + INTERVAL '30 days')",
        "ALTER TABLE markets ALTER COLUMN expires_at SET NOT NULL",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS estimated_probability DOUBLE PRECISION DEFAULT 0.5",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS shares_delta DOUBLE PRECISION DEFAULT 0.0",
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS round_index INTEGER DEFAULT 1",
        """
        CREATE TABLE IF NOT EXISTS market_proposals (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            question VARCHAR(500) NOT NULL,
            description TEXT DEFAULT '',
            resolution_criteria TEXT NOT NULL,
            category VARCHAR(120) DEFAULT 'general',
            expires_at TIMESTAMP NOT NULL,
            status VARCHAR(40) DEFAULT 'pending_review',
            moderation_notes TEXT DEFAULT '',
            duplicate_of_market_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_market_proposals_user_id ON market_proposals(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_market_proposals_status ON market_proposals(status)",
        """
        CREATE TABLE IF NOT EXISTS forecast_queries (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            question VARCHAR(500) NOT NULL,
            category VARCHAR(120) DEFAULT 'general',
            probability DOUBLE PRECISION DEFAULT 0.5,
            confidence DOUBLE PRECISION DEFAULT 0.5,
            summary TEXT DEFAULT '',
            key_uncertainty_drivers JSONB DEFAULT '[]'::jsonb,
            disagreement_summary TEXT DEFAULT '',
            supporting_evidence JSONB DEFAULT '[]'::jsonb,
            related_market_ids JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_forecast_queries_user_id ON forecast_queries(user_id)",
    ]
    async with engine.begin() as conn:
        for statement in statements:
            await conn.execute(text(statement))


@app.on_event("startup")
async def seed_admin_account() -> None:
    """Ensure a fixed development admin account always exists."""
    from app.core.auth import hash_password

    admin_email = "admin@gmail.com"
    admin_username = "admin"
    admin_password_hash = hash_password("admin")

    async with engine.begin() as conn:
        row = await conn.execute(
            text(
                """
                SELECT id, email, username
                FROM users
                WHERE email = :email OR username = :username
                ORDER BY CASE
                    WHEN email = :email THEN 0
                    WHEN username = :username THEN 1
                    ELSE 2
                END
                LIMIT 1
                """
            ),
            {"email": admin_email, "username": admin_username},
        )
        admin = row.mappings().first()

        if admin:
            await conn.execute(
                text(
                    """
                    UPDATE users
                    SET username = :username,
                        email = :email,
                        password_hash = :password_hash,
                        name = 'Administrator',
                        role = 'admin',
                        is_active = true,
                        updated_at = NOW()
                    WHERE id = :uid
                    """
                ),
                {
                    "uid": admin["id"],
                    "email": admin_email,
                    "username": admin_username,
                    "password_hash": admin_password_hash,
                },
            )
        else:
            await conn.execute(
                text(
                    """
                    INSERT INTO users (
                        id, email, username, password_hash, name, role, is_active, created_at, updated_at
                    ) VALUES (
                        :id, :email, :username, :password_hash, 'Administrator', 'admin', true, NOW(), NOW()
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "email": admin_email,
                    "username": admin_username,
                    "password_hash": admin_password_hash,
                },
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
