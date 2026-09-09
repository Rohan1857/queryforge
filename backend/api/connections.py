"""Connection management API — CRUD, test, sync, schema, preview."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.session import get_db_session
from backend.dependencies import get_current_user
from backend.models.connection import DataConnection
from backend.models.user import User
from backend.models.widget import Widget
from backend.schemas.connection import (
    ConnectionCreate,
    ConnectionRead,
    ConnectionTest,
    SchemaMetadata,
)
from backend.services.connectors.factory import ConnectorFactory
from backend.utils.encryption import decrypt_config, encrypt_config

router = APIRouter(prefix="/connections", tags=["connections"])


# ── helpers ──────────────────────────────────────────────────

async def _get_redis(request: Request):
    return getattr(request.app.state, "redis", None)


async def _get_connection_or_404(
    conn_id: str, user: User, db: AsyncSession
) -> DataConnection:
    try:
        uid = uuid.UUID(conn_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid connection ID")
    result = await db.execute(
        select(DataConnection).where(
            DataConnection.id == uid, DataConnection.user_id == user.id
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")
    return conn


def _decrypt(conn: DataConnection) -> dict:
    """Decrypt a connection's stored config."""
    raw = conn.config
    if isinstance(raw, str):
        return decrypt_config(raw, settings.JWT_SECRET)
    # If stored as dict (legacy/unencrypted), return as-is
    return decrypt_config(raw, settings.JWT_SECRET) if raw else {}


# ── routes ───────────────────────────────────────────────────

@router.post("", response_model=ConnectionRead, status_code=status.HTTP_201_CREATED)
async def create_connection(
    body: ConnectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    encrypted = encrypt_config(body.config, settings.JWT_SECRET)
    conn = DataConnection(
        user_id=user.id,
        name=body.name,
        type=body.type,
        config=encrypted,
        status="active",
    )
    db.add(conn)
    await db.flush()
    await db.refresh(conn)
    return conn


@router.get("", response_model=list[ConnectionRead])
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(DataConnection)
        .where(DataConnection.user_id == user.id)
        .order_by(DataConnection.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{conn_id}", response_model=ConnectionRead)
async def get_connection(
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await _get_connection_or_404(conn_id, user, db)


@router.put("/{conn_id}", response_model=ConnectionRead)
async def update_connection(
    conn_id: str,
    body: ConnectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    conn.name = body.name
    conn.type = body.type
    conn.config = encrypt_config(body.config, settings.JWT_SECRET)
    await db.flush()
    await db.refresh(conn)
    return conn


@router.delete("/{conn_id}", status_code=status.HTTP_200_OK)
async def delete_connection(
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    # Warn if widgets depend on this connection
    widget_count = (
        await db.execute(
            select(Widget).where(Widget.connection_id == conn.id)
        )
    ).scalars().all()
    warning = None
    if widget_count:
        warning = f"{len(widget_count)} widget(s) still reference this connection"
    await db.delete(conn)
    return {"deleted": True, "warning": warning}


@router.post("/{conn_id}/test", response_model=ConnectionTest)
async def test_connection(
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    config = _decrypt(conn)
    connector = ConnectorFactory.create(conn.type, config)
    try:
        await connector.test_connection()
        schema = await connector.get_schema()
        return ConnectionTest(success=True, message="Connection successful", schema_info=schema)
    except Exception as e:
        logger.warning(f"Connection test failed for {conn_id}: {e}")
        return ConnectionTest(success=False, message=str(e))
    finally:
        await connector.disconnect()


@router.post("/{conn_id}/sync", response_model=SchemaMetadata)
async def sync_schema(
    conn_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    config = _decrypt(conn)
    connector = ConnectorFactory.create(conn.type, config)
    try:
        schema = await connector.get_schema()
        # Update DB
        conn.schema_cache = schema.model_dump()
        conn.last_synced = datetime.now(timezone.utc)
        await db.flush()
        # Update Redis cache
        redis = await _get_redis(request)
        if redis:
            import json
            await redis.setex(
                f"schema:{conn.id}", 300, json.dumps(schema.model_dump())
            )
        return schema
    finally:
        await connector.disconnect()


@router.get("/{conn_id}/schema", response_model=SchemaMetadata)
async def get_schema(
    conn_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    # Try Redis first
    redis = await _get_redis(request)
    if redis:
        import json
        cached = await redis.get(f"schema:{conn.id}")
        if cached:
            return SchemaMetadata.model_validate(json.loads(cached))
    # Fall back to DB cache
    if conn.schema_cache:
        return SchemaMetadata.model_validate(conn.schema_cache)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Schema not cached. Run /sync first.")


@router.get("/{conn_id}/preview/{table_name}")
async def preview_table(
    conn_id: str,
    table_name: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    conn = await _get_connection_or_404(conn_id, user, db)
    config = _decrypt(conn)
    connector = ConnectorFactory.create(conn.type, config)
    try:
        rows = await connector.get_sample_data(table_name, limit=20)
        return {"table": table_name, "rows": rows, "count": len(rows)}
    finally:
        await connector.disconnect()
