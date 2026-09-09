"""SQLite connector using aiosqlite."""

from __future__ import annotations

import time

import aiosqlite
from loguru import logger

from backend.schemas.connection import ColumnMetadata, SchemaMetadata, TableMetadata
from backend.services.connectors.base import (
    ConnectionError,
    QueryError,
    QueryResult,
)


class SQLiteConnector:
    def __init__(self, config: dict) -> None:
        self._config = config
        self._db_path: str = config.get("file_path", config.get("database", ":memory:"))
        self._conn: aiosqlite.Connection | None = None

    async def _get_conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            try:
                self._conn = await aiosqlite.connect(self._db_path)
                self._conn.row_factory = aiosqlite.Row
            except Exception as e:
                raise ConnectionError(f"SQLite connection failed: {e}") from e
        return self._conn

    async def test_connection(self) -> bool:
        try:
            conn = await self._get_conn()
            async with conn.execute("SELECT 1") as cursor:
                await cursor.fetchone()
            return True
        except Exception as e:
            raise ConnectionError(f"SQLite test failed: {e}") from e

    async def get_schema(self) -> SchemaMetadata:
        conn = await self._get_conn()
        tables: list[TableMetadata] = []

        async with conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ) as cursor:
            table_rows = await cursor.fetchall()

        for trow in table_rows:
            table_name = trow[0] if isinstance(trow, tuple) else trow["name"]

            # Get columns via PRAGMA
            async with conn.execute(f"PRAGMA table_info(\"{table_name}\")") as cursor:
                col_rows = await cursor.fetchall()

            # Get foreign keys
            async with conn.execute(f"PRAGMA foreign_key_list(\"{table_name}\")") as cursor:
                fk_rows = await cursor.fetchall()

            fk_cols: set[str] = set()
            relationships: list[dict] = []
            for fk in fk_rows:
                from_col = fk[3] if isinstance(fk, tuple) else fk["from"]
                to_table = fk[2] if isinstance(fk, tuple) else fk["table"]
                to_col = fk[4] if isinstance(fk, tuple) else fk["to"]
                fk_cols.add(from_col)
                relationships.append({"column": from_col, "references": f"{to_table}.{to_col}"})

            # Row count
            async with conn.execute(f"SELECT COUNT(*) FROM \"{table_name}\"") as cursor:  # noqa: S608
                count_row = await cursor.fetchone()
            row_count = count_row[0] if count_row else 0

            columns: list[ColumnMetadata] = []
            for crow in col_rows:
                col_name = crow[1] if isinstance(crow, tuple) else crow["name"]
                col_type = crow[2] if isinstance(crow, tuple) else crow["type"]
                is_pk = bool(crow[5] if isinstance(crow, tuple) else crow["pk"])

                samples: list[str] = []
                try:
                    async with conn.execute(
                        f'SELECT DISTINCT "{col_name}" FROM "{table_name}" '  # noqa: S608
                        f'WHERE "{col_name}" IS NOT NULL LIMIT 5'
                    ) as cursor:
                        sample_rows = await cursor.fetchall()
                        samples = [str(r[0] if isinstance(r, tuple) else list(dict(r).values())[0]) for r in sample_rows]
                except Exception:
                    pass

                columns.append(
                    ColumnMetadata(
                        name=col_name,
                        type=col_type or "TEXT",
                        is_primary_key=is_pk,
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
        conn = await self._get_conn()
        start = time.perf_counter()
        try:
            async with conn.execute(sql, params or []) as cursor:
                raw_rows = await cursor.fetchall()
                col_names = [desc[0] for desc in cursor.description] if cursor.description else []
        except Exception as e:
            raise QueryError(f"SQLite query failed: {e}") from e

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        rows = [dict(zip(col_names, r)) for r in raw_rows]

        return QueryResult(
            columns=col_names,
            rows=rows,
            row_count=len(rows),
            execution_ms=elapsed_ms,
        )

    async def get_sample_data(self, table: str, limit: int = 20) -> list[dict]:
        result = await self.execute_query(
            f'SELECT * FROM "{table}" LIMIT {limit}'  # noqa: S608
        )
        return result.rows

    async def disconnect(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None
            logger.debug("SQLite connection closed")
