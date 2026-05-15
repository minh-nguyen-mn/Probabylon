from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("DATABASE_URL_UNPOOLED", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-access-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("BROKER_URL", "redis://localhost:6379/14")
os.environ.setdefault("RESULT_BACKEND", "redis://localhost:6379/13")

from app.db.models import Base  # noqa: E402
from app.core.auth import hash_password  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.db.models import User  # noqa: E402


TEST_ENGINE = create_async_engine("sqlite+aiosqlite:///./test.db", future=True)
TestingSessionLocal = async_sessionmaker(TEST_ENGINE, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        session.add_all(
            [
                User(
                    email="admin@probabylon.ai",
                    username="probabylon_admin",
                    password_hash=hash_password("Admin123!Secure"),
                    name="Probabylon Admin",
                    role="admin",
                    is_active=True,
                ),
                User(
                    email="admin@gmail.com",
                    username="admin",
                    password_hash=hash_password("admin"),
                    name="Primary Admin",
                    role="admin",
                    is_active=True,
                ),
            ]
        )
        await session.commit()
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
