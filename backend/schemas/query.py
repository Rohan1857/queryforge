from typing import Any, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    connection_id: str
    sql: str
    params: Optional[list[Any]] = Field(default_factory=list)


class QueryResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    execution_ms: int
