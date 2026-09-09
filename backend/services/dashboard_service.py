"""Dashboard business logic — CRUD + layout management."""

from __future__ import annotations

import copy
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.dashboard import Dashboard
from backend.models.widget import Widget


async def get_user_dashboards(user_id: uuid.UUID, db: AsyncSession) -> list[Dashboard]:
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.widgets))
        .where(Dashboard.user_id == user_id)
        .order_by(Dashboard.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_dashboard(
    dashboard_id: uuid.UUID,
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    public_ok: bool = False,
) -> Dashboard | None:
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.widgets))
        .where(Dashboard.id == dashboard_id)
    )
    dashboard = result.scalar_one_or_none()
    if dashboard is None:
        return None

    if public_ok and dashboard.is_public:
        return dashboard
    if user_id and dashboard.user_id == user_id:
        return dashboard
    return None


async def create_dashboard(
    user_id: uuid.UUID, title: str, description: str | None, db: AsyncSession
) -> Dashboard:
    dashboard = Dashboard(
        user_id=user_id,
        title=title,
        description=description,
        layout={},
        settings={},
    )
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


async def duplicate_dashboard(
    original: Dashboard, user_id: uuid.UUID, db: AsyncSession
) -> Dashboard:
    new_dashboard = Dashboard(
        user_id=user_id,
        title=f"{original.title} (Copy)",
        description=original.description,
        layout=copy.deepcopy(original.layout) if original.layout else {},
        settings=copy.deepcopy(original.settings) if original.settings else {},
    )
    db.add(new_dashboard)
    await db.flush()

    for w in original.widgets:
        new_widget = Widget(
            dashboard_id=new_dashboard.id,
            connection_id=w.connection_id,
            type=w.type,
            title=w.title,
            prompt_used=w.prompt_used,
            query_config=copy.deepcopy(w.query_config) if w.query_config else {},
            chart_config=copy.deepcopy(w.chart_config) if w.chart_config else {},
            layout_position=copy.deepcopy(w.layout_position) if w.layout_position else {},
            cached_data=copy.deepcopy(w.cached_data) if w.cached_data else None,
            refresh_interval=w.refresh_interval,
        )
        db.add(new_widget)

    await db.flush()
    await db.refresh(new_dashboard)
    return new_dashboard


async def batch_update_layout(
    dashboard: Dashboard,
    positions: list[dict],
    db: AsyncSession,
) -> None:
    widget_ids = []
    positions_map: dict[uuid.UUID, dict] = {}
    for item in positions:
        try:
            w_uuid = uuid.UUID(item["id"])
            widget_ids.append(w_uuid)
            positions_map[w_uuid] = {
                "x": item["x"],
                "y": item["y"],
                "w": item["w"],
                "h": item["h"],
            }
        except (ValueError, KeyError):
            continue

    if widget_ids:
        result = await db.execute(
            select(Widget).where(
                Widget.id.in_(widget_ids), Widget.dashboard_id == dashboard.id
            )
        )
        widgets = result.scalars().all()
        for widget in widgets:
            widget.layout_position = positions_map[widget.id]

    await db.flush()
