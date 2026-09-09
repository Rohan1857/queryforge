"""Base protocol and types for all data connectors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from backend.schemas.connection import SchemaMetadata


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    execution_ms: int = 0


class ConnectorError(Exception):
    """Base error for all connector failures."""


class ConnectionError(ConnectorError):
    """Failed to connect to the data source."""


class QueryError(ConnectorError):
    """Query execution failed."""


class QueryTimeoutError(ConnectorError):
    """Query exceeded the timeout."""


@runtime_checkable
class DataConnector(Protocol):
    async def test_connection(self) -> bool: ...
    async def get_schema(self) -> SchemaMetadata: ...
    async def execute_query(self, sql: str, params: list | None = None) -> QueryResult: ...
    async def get_sample_data(self, table: str, limit: int = 20) -> list[dict]: ...
    async def disconnect(self) -> None: ...
