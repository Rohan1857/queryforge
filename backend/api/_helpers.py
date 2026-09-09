"""Shared helpers for API route modules."""

from __future__ import annotations

from backend.models.widget import Widget


def widget_to_dict(w: Widget) -> dict:
    """Serialize a Widget ORM instance to a plain dict for API responses."""
    return {
        "id": str(w.id),
        "dashboard_id": str(w.dashboard_id),
        "connection_id": str(w.connection_id) if w.connection_id else None,
        "type": w.type,
        "title": w.title,
        "prompt_used": w.prompt_used,
        "query_config": w.query_config or {},
        "chart_config": w.chart_config or {},
        "layout_position": w.layout_position or {},
        "data": (w.cached_data or {}).get("rows", []),
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }
