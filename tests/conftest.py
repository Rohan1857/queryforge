"""Shared test fixtures for the QueryForge backend test suite."""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import os
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("REDIS_URL", "memory://")
os.environ.setdefault("JWT_SECRET", "test-secret-key-queryforge")

import backend.models  # noqa: F401  # Ensure SQLAlchemy metadata is populated for tests.
from backend.db.base import Base
from backend.db.session import get_db_session
from backend.dependencies import get_current_user
from backend.models.user import User

# ---------------------------------------------------------------------------
# Use an in-memory SQLite database for tests so no Postgres needed
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "sqlite+aiosqlite:///:memory:",
)

_test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
_TestSessionLocal = async_sessionmaker(_test_engine, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Event Loop
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# Database setup / teardown
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    """Create all tables once per test session, drop when done."""
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional DB session that rolls back after each test."""
    async with _TestSessionLocal() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# Fake authenticated user
# ---------------------------------------------------------------------------
_FAKE_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Ensure a test user exists and return it."""
    from sqlalchemy import select

    result = await db_session.execute(select(User).where(User.id == _FAKE_USER_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=_FAKE_USER_ID,
            email="test@example.com",
            name="Test User",
            password_hash="not-a-real-hash",
        )
        db_session.add(user)
        await db_session.flush()
    return user


# ---------------------------------------------------------------------------
# Async HTTP client wired to the FastAPI app
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db_session: AsyncSession, test_user: User) -> AsyncGenerator[AsyncClient, None]:
    """Authenticated async test client — overrides DB and auth dependencies."""
    # Import app lazily to avoid import-time side effects
    from backend.main import app

    # Override dependencies
    app.dependency_overrides[get_db_session] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: test_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
