"""Widget business logic — CRUD + data refresh."""

from __future__ import annotations

import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.connection import DataConnection
from backend.models.widget import Widget
from backend.schemas.query import QueryResult
from backend.services.connectors.factory import ConnectorFactory
from backend.utils.encryption import decrypt_config
from backend.utils.helpers import to_json_compatible
from backend.utils.sql_validator import validate_sql


async def refresh_widget_data(
    widget: Widget,
    db: AsyncSession,
    encryption_key: str,
) -> Widget:
    """Re-execute a widget's stored query and update cached_data."""
    sql = (widget.query_config or {}).get("sql")
    if not sql:
        raise ValueError("Widget has no stored query")
    if not widget.connection_id:
        raise ValueError("Widget has no connection")

    result = await db.execute(
        select(DataConnection).where(DataConnection.id == widget.connection_id)
    )
    db_conn = result.scalar_one_or_none()
    if db_conn is None:
        raise ValueError("Connection not found")

    validate_sql(sql)

    config = decrypt_config(db_conn.config, encryption_key)
    connector = ConnectorFactory.create(db_conn.type, config)
    try:
        params = (widget.query_config or {}).get("params")
        qr = await connector.execute_query(sql, params or None)
        widget.cached_data = {"rows": to_json_compatible(qr.rows)}
        await db.flush()
        await db.refresh(widget)
        return widget
    finally:
        await connector.disconnect()


async def get_widget_with_access_check(
    widget_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Widget | None:
    """Fetch a widget and verify the user owns the parent dashboard."""
    from backend.models.dashboard import Dashboard

    result = await db.execute(select(Widget).where(Widget.id == widget_id))
    widget = result.scalar_one_or_none()
    if widget is None:
        return None

    dash_result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == widget.dashboard_id, Dashboard.user_id == user_id
        )
    )
    if dash_result.scalar_one_or_none() is None:
        return None

    return widget
