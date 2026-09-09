from typing import Any, Optional

from pydantic import BaseModel, Field

from backend.schemas.widget import ChartConfig, LayoutPosition


class PromptRequest(BaseModel):
    prompt: str
    connection_id: Optional[str] = None
    dashboard_id: Optional[str] = None


class QueryInfo(BaseModel):
    sql: str
    params: list[Any] = Field(default_factory=list)
    execution_ms: int
    row_count: int


class WidgetResult(BaseModel):
    id: Optional[str] = None
    type: str
    title: str
    prompt_used: str
    query_config: dict
    chart_config: ChartConfig
    layout_position: LayoutPosition
    data: list[dict[str, Any]]
    explanation: str


class PromptResponse(BaseModel):
    widget: WidgetResult
    query_info: QueryInfo
    explanation: str


class PromptExplainRequest(BaseModel):
    prompt: str
    connection_id: Optional[str] = None


class PromptExplainResponse(BaseModel):
    answer: str
    query_used: str
    data: list[dict[str, Any]]


class PromptSuggestResponse(BaseModel):
    suggestions: list[str]
