"""MySQL connector using aiomysql."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import aiomysql
from loguru import logger

from backend.schemas.connection import ColumnMetadata, SchemaMetadata, TableMetadata
from backend.services.connectors.base import (
    ConnectionError,
    QueryError,
    QueryResult,
    QueryTimeoutError,
)


class MySQLConnector:
    def __init__(self, config: dict) -> None:
        self._config = config
        self._pool: aiomysql.Pool | None = None

    async def _get_pool(self) -> aiomysql.Pool:
        if self._pool is None:
            try:
                self._pool = await aiomysql.create_pool(
                    host=self._config["host"],
                    port=self._config.get("port", 3306),
                    db=self._config["database"],
                    user=self._config["username"],
                    password=self._config["password"],
                    minsize=1,
                    maxsize=5,
                    autocommit=True,
                )
            except Exception as e:
                raise ConnectionError(f"MySQL connection failed: {e}") from e
        return self._pool

    async def test_connection(self) -> bool:
        retries = 3
        for attempt in range(retries):
            try:
                pool = await self._get_pool()
                async with pool.acquire() as conn:
                    async with conn.cursor() as cur:
                        await cur.execute("SELECT 1")
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
        db_name = self._config["database"]

        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # Get tables
                await cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = %s AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                    """,
                    (db_name,),
                )
                table_rows = await cur.fetchall()

                tables: list[TableMetadata] = []
                for trow in table_rows:
                    table_name = trow["TABLE_NAME"] if "TABLE_NAME" in trow else trow["table_name"]

                    # Get columns
                    await cur.execute(
                        """
                        SELECT column_name, data_type, column_key
                        FROM information_schema.columns
                        WHERE table_schema = %s AND table_name = %s
                        ORDER BY ordinal_position
                        """,
                        (db_name, table_name),
                    )
                    col_rows = await cur.fetchall()

                    # Get foreign keys
                    await cur.execute(
                        """
                        SELECT column_name, referenced_table_name, referenced_column_name
                        FROM information_schema.key_column_usage
                        WHERE table_schema = %s AND table_name = %s
                            AND referenced_table_name IS NOT NULL
                        """,
                        (db_name, table_name),
                    )
                    fk_rows = await cur.fetchall()
                    fk_cols = {r.get("COLUMN_NAME", r.get("column_name")) for r in fk_rows}
                    relationships = [
                        {
                            "column": r.get("COLUMN_NAME", r.get("column_name")),
                            "references": (
                                f"{r.get('REFERENCED_TABLE_NAME', r.get('referenced_table_name'))}"
                                f".{r.get('REFERENCED_COLUMN_NAME', r.get('referenced_column_name'))}"
                            ),
                        }
                        for r in fk_rows
                    ]

                    # Row count
                    await cur.execute(f"SELECT COUNT(*) as cnt FROM `{table_name}`")  # noqa: S608
                    count_row = await cur.fetchone()
                    row_count = count_row.get("cnt", count_row.get("COUNT(*)", 0))

                    columns: list[ColumnMetadata] = []
                    for crow in col_rows:
                        col_name = crow.get("COLUMN_NAME", crow.get("column_name"))
                        col_key = crow.get("COLUMN_KEY", crow.get("column_key", ""))
                        data_type = crow.get("DATA_TYPE", crow.get("data_type"))

                        samples: list[str] = []
                        try:
                            await cur.execute(
                                f"SELECT DISTINCT `{col_name}` FROM `{table_name}` "  # noqa: S608
                                f"WHERE `{col_name}` IS NOT NULL LIMIT 5"
                            )
                            sample_rows = await cur.fetchall()
                            samples = [str(list(r.values())[0]) for r in sample_rows]
                        except Exception:
                            pass

                        columns.append(
                            ColumnMetadata(
                                name=col_name,
                                type=data_type,
                                is_primary_key=col_key == "PRI",
                                is_foreign_key=col_name in fk_cols,
                                sample_values=samples,
                            )
                        )

                    tables.append(
                        TableMetadata(
                            name=table_name,
                            columns=columns,
                            row_count=row_count,
                            relationships=relationships,
                        )
                    )

        return SchemaMetadata(tables=tables)

    async def execute_query(self, sql: str, params: list | None = None) -> QueryResult:
        pool = await self._get_pool()
        start = time.perf_counter()
        try:
            async with pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    coro = cur.execute(sql, params or ())
                    await asyncio.wait_for(coro, timeout=30)
                    rows = await cur.fetchall()
        except asyncio.TimeoutError as e:
            raise QueryTimeoutError("Query exceeded 30s timeout") from e
        except Exception as e:
            raise QueryError(f"Query execution failed: {e}") from e

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        columns = list(rows[0].keys()) if rows else []

        return QueryResult(
            columns=columns,
            rows=list(rows),
            row_count=len(rows),
            execution_ms=elapsed_ms,
        )

    async def get_sample_data(self, table: str, limit: int = 20) -> list[dict]:
        result = await self.execute_query(
            f"SELECT * FROM `{table}` LIMIT {limit}"  # noqa: S608
        )
        return result.rows

    async def disconnect(self) -> None:
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None
            logger.debug("MySQL pool closed")
