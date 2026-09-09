from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import socketio
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import ValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.db.session import get_db_session

from backend.config import settings
from backend.middleware.error_handler import (
    generic_error_handler,
    rate_limit_handler,
    validation_error_handler,
)
from backend.middleware.rate_limiter import limiter

# ── Constants ───────────────────────────────────────────────
_WS_NAMESPACE = "/dashboard"

# ── Socket.IO server ────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    namespaces=[_WS_NAMESPACE],
)


@sio.event(namespace=_WS_NAMESPACE)
async def connect(sid, environ, auth=None):
    """Verify JWT on WebSocket connect, then join dashboard room."""
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        # Try from query string
        qs = environ.get("QUERY_STRING", "")
        for part in qs.split("&"):
            if part.startswith("token="):
                token = part.split("=", 1)[1]
    if not token:
        logger.warning(f"WS connect rejected (no token): {sid}")
        raise socketio.exceptions.ConnectionRefusedError("Authentication required")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise socketio.exceptions.ConnectionRefusedError("Invalid token")
    except JWTError:
        raise socketio.exceptions.ConnectionRefusedError("Invalid token")

    await sio.save_session(sid, {"user_id": user_id}, namespace=_WS_NAMESPACE)
    logger.info(f"WS connected: {sid} (user {user_id})")


@sio.event(namespace=_WS_NAMESPACE)
async def join_dashboard(sid, data):
    """Client joins a dashboard room to receive real-time updates."""
    dashboard_id = data.get("dashboard_id") if isinstance(data, dict) else data
    if dashboard_id:
        sio.enter_room(sid, dashboard_id, namespace=_WS_NAMESPACE)
        logger.debug(f"WS {sid} joined room {dashboard_id}")


@sio.event(namespace=_WS_NAMESPACE)
async def leave_dashboard(sid, data):
    dashboard_id = data.get("dashboard_id") if isinstance(data, dict) else data
    if dashboard_id:
        sio.leave_room(sid, dashboard_id, namespace=_WS_NAMESPACE)


@sio.event(namespace=_WS_NAMESPACE)
async def disconnect(sid):
    logger.debug(f"WS disconnected: {sid}")


# ── FastAPI app ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Prompt BI backend...")

    # Store socketio reference for route handlers
    app.state.sio = sio

    # Connect to Redis
    app.state.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await app.state.redis.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
        app.state.redis = None

    yield

    # Shutdown
    if app.state.redis:
        await app.state.redis.close()
    logger.info("Prompt BI backend shut down")


app = FastAPI(
    title="Prompt BI",
    description="Natural-language Business Intelligence platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiter & error handlers ────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_exception_handler(ValidationError, validation_error_handler)
app.add_exception_handler(Exception, generic_error_handler)

# ── Include API routers ─────────────────────────────────────
from backend.api.router import api_router

app.include_router(api_router)


# ── Public (no-auth) endpoint for shared dashboards ─────────
@app.get("/api/public/dashboard/{dashboard_id}")
async def get_public_dashboard(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """No auth required — returns dashboard if is_public=True."""
    import uuid as _uuid

    from sqlalchemy.orm import selectinload

    from backend.models.dashboard import Dashboard

    try:
        uid = _uuid.UUID(dashboard_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dashboard ID")

    result = await db.execute(
        select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.id == uid)
    )
    dashboard = result.scalar_one_or_none()
    if dashboard is None or not dashboard.is_public:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    widgets_data = []
    for w in dashboard.widgets:
        widgets_data.append({
            "id": str(w.id),
            "dashboard_id": str(w.dashboard_id),
            "type": w.type,
            "title": w.title,
            "prompt_used": w.prompt_used,
            "chart_config": w.chart_config or {},
            "layout_position": w.layout_position or {},
            "data": (w.cached_data or {}).get("rows", []),
            "created_at": w.created_at.isoformat() if w.created_at else None,
        })

    return {
        "id": str(dashboard.id),
        "title": dashboard.title,
        "description": dashboard.description,
        "layout": dashboard.layout or {},
        "settings": dashboard.settings or {},
        "is_public": dashboard.is_public,
        "widget_count": len(dashboard.widgets),
        "created_at": dashboard.created_at,
        "updated_at": dashboard.updated_at,
        "widgets": widgets_data,
    }


@app.get("/api/health")
async def health_check():
    redis_ok = False
    if hasattr(app.state, "redis") and app.state.redis:
        try:
            await app.state.redis.ping()
            redis_ok = True
        except Exception:
            pass

    db_ok = False
    try:
        from backend.db.engine import async_engine
        from sqlalchemy import text

        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass

    return {"status": "ok", "db": db_ok, "redis": redis_ok}


# ── Combined ASGI app (FastAPI + Socket.IO) ──────────────────
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app)
