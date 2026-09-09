import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChartConfig(BaseModel):
    x_field: str
    y_fields: list[str]
    group_field: str | None = None
    aggregation: str = "sum"
    colors: list[str] = Field(default_factory=list)
    stacked: bool = False
    show_values: bool = True
    orientation: str = "vertical"
    x_axis_label: str | None = None
    y_axis_label: str | None = None
    metric_name: str | None = None
    card_description: str | None = None
    prefix: str | None = None
    suffix: str | None = None
    show_legend: bool = True
    show_tooltip: bool = True
    show_grid: bool = True
    histogram_bins: int | None = None
    style_config: dict[str, Any] = Field(default_factory=dict)
    metric_config: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}


class LayoutPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int
    min_w: int = 2
    min_h: int = 2
    position: int | None = None


class WidgetCreate(BaseModel):
    dashboard_id: str
    type: str
    title: str | None = None
    connection_id: str | None = None
    query_config: dict
    chart_config: dict
    layout_position: dict


class WidgetRead(BaseModel):
    id: uuid.UUID
    dashboard_id: uuid.UUID
    connection_id: uuid.UUID | None = None
    type: str
    title: str | None = None
    prompt_used: str | None = None
    query_config: dict = Field(default_factory=dict)
    chart_config: dict
    layout_position: dict
    data: list[dict[str, Any]] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WidgetUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    query_config: dict | None = None
    chart_config: dict | None = None
    layout_position: dict | None = None
