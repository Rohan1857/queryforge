"""Assemble a complete widget from query results and chart configuration."""

from __future__ import annotations

from typing import Any

from backend.schemas.prompt import WidgetResult
from backend.schemas.widget import ChartConfig, LayoutPosition

# Default color palette (8 colors — vibrant but distinct)
DEFAULT_COLORS = [
    "#6366F1",  # indigo
    "#F59E0B",  # amber
    "#10B981",  # emerald
    "#EF4444",  # red
    "#3B82F6",  # blue
    "#8B5CF6",  # violet
    "#EC4899",  # pink
    "#14B8A6",  # teal
]

# Default layout sizes by widget type
_DEFAULT_LAYOUTS: dict[str, dict[str, int]] = {
    "kpi": {"w": 3, "h": 2, "min_w": 2, "min_h": 2},
    "table": {"w": 12, "h": 6, "min_w": 4, "min_h": 3},
    "bar": {"w": 6, "h": 4, "min_w": 3, "min_h": 3},
    "line": {"w": 6, "h": 4, "min_w": 3, "min_h": 3},
    "pie": {"w": 4, "h": 4, "min_w": 3, "min_h": 3},
    "scatter": {"w": 6, "h": 4, "min_w": 3, "min_h": 3},
}


def _normalize_chart_config(
    chart_type: str,
    chart_config: dict[str, Any] | None,
    query_result: list[dict[str, Any]],
    explanation: str,
) -> dict[str, Any]:
    """Coerce sparse LLM output into a chart config the UI can render."""
    config = dict(chart_config or {})
    first_row = query_result[0] if query_result else {}
    available_fields = list(first_row.keys())
    numeric_fields = [
        field for field in available_fields if isinstance(first_row.get(field), (int, float))
    ]
    categorical_fields = [
        field for field in available_fields if field not in numeric_fields
    ]

    raw_y_fields = config.get("y_fields")
    if isinstance(raw_y_fields, list):
        y_fields = [str(field) for field in raw_y_fields if field not in (None, "")]
    elif raw_y_fields not in (None, ""):
        y_fields = [str(raw_y_fields)]
    else:
        y_fields = []

    metric_name = str(
        config.get("metric_name")
        or (y_fields[0] if y_fields else "")
        or (numeric_fields[0] if numeric_fields else "")
    )
    x_field = str(
        config.get("x_field")
        or (categorical_fields[0] if categorical_fields else "")
        or metric_name
        or (available_fields[0] if available_fields else "")
    )

    if not y_fields and metric_name:
        y_fields = [metric_name]
    elif not y_fields and numeric_fields:
        y_fields = [numeric_fields[0]]

    return {
        "x_field": x_field,
        "y_fields": y_fields,
        "group_field": config.get("group_field"),
        "aggregation": str(config.get("aggregation") or "sum"),
        "colors": list(config.get("colors") or DEFAULT_COLORS[: max(len(y_fields), 1)]),
        "stacked": bool(config.get("stacked", False)),
        "show_values": bool(config.get("show_values", True)),
        "orientation": str(config.get("orientation") or "vertical"),
        "x_axis_label": str(config.get("x_axis_label") or x_field or metric_name),
        "y_axis_label": str(config.get("y_axis_label") or metric_name or x_field),
        "metric_name": metric_name or None,
        "card_description": str(config.get("card_description") or explanation or "").strip() or None,
        "prefix": config.get("prefix"),
        "suffix": config.get("suffix"),
        "show_legend": bool(config.get("show_legend", chart_type != "kpi")),
        "show_tooltip": bool(config.get("show_tooltip", True)),
        "show_grid": bool(config.get("show_grid", chart_type != "kpi")),
        "histogram_bins": config.get("histogram_bins"),
        "style_config": dict(config.get("style_config") or {}),
        "metric_config": dict(config.get("metric_config") or {}),
    }


def _detect_number_format(values: list) -> str:
    """Detect if values look like currency, percentage, or plain numbers."""
    if not values:
        return "number"
    sample = values[0]
    if isinstance(sample, str):
        if "%" in sample:
            return "percent"
        if "$" in sample or "€" in sample or "£" in sample:
            return "currency"
    if isinstance(sample, (int, float)):
        if 0 < abs(sample) < 1:
            return "percent"
        if abs(sample) > 1_000_000:
            return "compact"
    return "number"


def _find_next_position(existing_positions: list[dict]) -> tuple[int, int]:
    """Find the next open grid slot (12-column grid)."""
    if not existing_positions:
        return 0, 0

    max_y = 0
    max_y_bottom = 0
    for pos in existing_positions:
        bottom = pos.get("y", 0) + pos.get("h", 4)
        if bottom > max_y_bottom:
            max_y_bottom = bottom
            max_y = pos.get("y", 0)

    # Place below the last widget
    return 0, max_y_bottom


def _find_next_order(existing_positions: list[dict]) -> int:
    """Assign a stable order index for newly created widgets."""
    if not existing_positions:
        return 0

    return max(
        int(position.get("position", index))
        for index, position in enumerate(existing_positions)
    ) + 1


def build_widget(
    prompt: str,
    query_result: list[dict[str, Any]],
    chart_type: str,
    chart_config: dict,
    title: str,
    explanation: str,
    connection_id: str | None = None,
    dashboard_id: str | None = None,
    existing_positions: list[dict] | None = None,
    sql: str = "",
    params: list | None = None,
) -> WidgetResult:
    """Assemble the complete widget with layout, colors, and formatting."""
    normalized_chart_config = _normalize_chart_config(
        chart_type=chart_type,
        chart_config=chart_config,
        query_result=query_result,
        explanation=explanation,
    )
    widget_chart_config = ChartConfig(**normalized_chart_config)

    # Layout position
    layout_defaults = _DEFAULT_LAYOUTS.get(chart_type, _DEFAULT_LAYOUTS["bar"])
    x, y = _find_next_position(existing_positions or [])
    layout = LayoutPosition(
        x=x,
        y=y,
        w=layout_defaults["w"],
        h=layout_defaults["h"],
        min_w=layout_defaults["min_w"],
        min_h=layout_defaults["min_h"],
        position=_find_next_order(existing_positions or []),
    )

    # Query config (stored so widget can be refreshed later)
    query_config = {"sql": sql, "params": params or [], "connection_id": connection_id}

    return WidgetResult(
        type=chart_type,
        title=title,
        prompt_used=prompt,
        query_config=query_config,
        chart_config=widget_chart_config,
        layout_position=layout,
        data=query_result,
        explanation=explanation,
    )
