"""PostgreSQL connector using asyncpg."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import asyncpg
from loguru import logger

from backend.schemas.connection import ColumnMetadata, SchemaMetadata, TableMetadata
from backend.services.connectors.base import (
    ConnectionError,
    QueryError,
    QueryResult,
    QueryTimeoutError,
)


class PostgresConnector:
    def __init__(self, config: dict) -> None:
        self._config = config
        self._pool: asyncpg.Pool | None = None

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            try:
                self._pool = await asyncpg.create_pool(
                    host=self._config["host"],
                    port=self._config.get("port", 5432),
                    database=self._config["database"],
                    user=self._config["username"],
                    password=self._config["password"],
                    ssl=self._config.get("ssl", False) or None,
                    min_size=1,
                    max_size=5,
                    command_timeout=30,
                )
            except Exception as e:
                raise ConnectionError(f"PostgreSQL connection failed: {e}") from e
        return self._pool

    async def test_connection(self) -> bool:
        retries = 3
        for attempt in range(retries):
            try:
                pool = await self._get_pool()
                async with pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                return True
            except ConnectionError:
                raise
            except Exception as e:
                if attempt == retries - 1:
                    raise ConnectionError(f"Connection test failed after {retries} attempts: {e}")
                await asyncio.sleep(1)
        return False

    async def get_schema(self) -> SchemaMetadata:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            # Get all tables
            tables_rows = await conn.fetch(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )

            tables: list[TableMetadata] = []
            for trow in tables_rows:
                table_name = trow["table_name"]

                # Get columns
                col_rows = await conn.fetch(
                    """
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = $1
                    ORDER BY ordinal_position
                    """,
                    table_name,
                )

                # Get primary keys
                pk_rows = await conn.fetch(
                    """
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_schema = 'public'
                        AND tc.table_name = $1
                        AND tc.constraint_type = 'PRIMARY KEY'
                    """,
                    table_name,
                )
                pk_cols = {r["column_name"] for r in pk_rows}

                # Get foreign keys
                fk_rows = await conn.fetch(
                    """
                    SELECT kcu.column_name,
                           ccu.table_name AS foreign_table,
                           ccu.column_name AS foreign_column
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu
                        ON tc.constraint_name = ccu.constraint_name
                    WHERE tc.table_schema = 'public'
                        AND tc.table_name = $1
                        AND tc.constraint_type = 'FOREIGN KEY'
                    """,
                    table_name,
                )
                fk_cols = {r["column_name"] for r in fk_rows}
                relationships = [
                    {
                        "column": r["column_name"],
                        "references": f"{r['foreign_table']}.{r['foreign_column']}",
                    }
                    for r in fk_rows
                ]

                # Row count (approximate for speed)
                count_row = await conn.fetchval(
                    f"SELECT COUNT(*) FROM \"{table_name}\""  # noqa: S608
                )

                # Build columns with sample values
                columns: list[ColumnMetadata] = []
                for crow in col_rows:
                    col_name = crow["column_name"]
                    samples: list[str] = []
                    try:
                        sample_rows = await conn.fetch(
                            f'SELECT DISTINCT "{col_name}" FROM "{table_name}" '  # noqa: S608
                            f"WHERE \"{col_name}\" IS NOT NULL LIMIT 5"
                        )
                        samples = [str(r[col_name]) for r in sample_rows]
                    except Exception:
                        pass

                    columns.append(
                        ColumnMetadata(
                            name=col_name,
                            type=crow["data_type"],
                            is_primary_key=col_name in pk_cols,
                            is_foreign_key=col_name in fk_cols,
                            sample_values=samples,
                        )
                    )

                tables.append(
                    TableMetadata(
                        name=table_name,
                        columns=columns,
                        row_count=count_row or 0,
                        relationships=relationships,
                    )
                )

            return SchemaMetadata(tables=tables)

    async def execute_query(self, sql: str, params: list | None = None) -> QueryResult:
        pool = await self._get_pool()
        start = time.perf_counter()
        try:
            async with pool.acquire() as conn:
                if params:
                    rows = await asyncio.wait_for(
                        conn.fetch(sql, *params), timeout=30
                    )
                else:
                    rows = await asyncio.wait_for(conn.fetch(sql), timeout=30)
        except asyncio.TimeoutError as e:
            raise QueryTimeoutError("Query exceeded 30s timeout") from e
        except Exception as e:
            raise QueryError(f"Query execution failed: {e}") from e

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        if rows:
            columns = list(rows[0].keys())
            row_dicts = [dict(r) for r in rows]
        else:
            columns = []
            row_dicts = []

        return QueryResult(
            columns=columns,
            rows=row_dicts,
            row_count=len(row_dicts),
            execution_ms=elapsed_ms,
        )

    async def get_sample_data(self, table: str, limit: int = 20) -> list[dict]:
        result = await self.execute_query(
            f'SELECT * FROM "{table}" LIMIT {limit}'  # noqa: S608
        )
        return result.rows

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.debug("PostgreSQL pool closed")
