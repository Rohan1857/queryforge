"""CSV file connector — loads into DuckDB for SQL querying."""

from __future__ import annotations

import os

import pandas as pd
from loguru import logger

from backend.services.connectors._duckdb_mixin import DuckDBMixin
from backend.services.connectors.base import ConnectionError


class CSVConnector(DuckDBMixin):
    def __init__(self, config: dict) -> None:
        self._config = config
        self._file_path: str = config["file_path"]
        raw_name = (
            os.path.splitext(os.path.basename(self._file_path))[0]
            .replace(" ", "_")
            .replace("-", "_")
            .lower()
        )
        # Strip UUID prefix (e.g. "ab12cd34_demo_sales" → "demo_sales")
        parts = raw_name.split("_", 1)
        if len(parts) == 2 and len(parts[0]) == 32 and all(c in "0123456789abcdef" for c in parts[0]):
            raw_name = parts[1]
        # Ensure name starts with a letter (valid SQL identifier)
        if raw_name and not raw_name[0].isalpha():
            raw_name = "t_" + raw_name
        self._table_name: str = raw_name
        self._duckdb = None
        self._table_names: list[str] = []
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            df = pd.read_csv(self._file_path, nrows=None)
            # Clean column names: spaces → underscores, lowercase
            df.columns = [c.strip().replace(" ", "_").lower() for c in df.columns]
            self._register_dataframe(self._table_name, df)
            self._loaded = True
            logger.debug(f"CSV loaded: {self._file_path} → table '{self._table_name}' ({len(df)} rows)")
        except FileNotFoundError as e:
            raise ConnectionError(f"CSV file not found: {self._file_path}") from e
        except Exception as e:
            raise ConnectionError(f"Failed to load CSV: {e}") from e

    async def test_connection(self) -> bool:
        self._load()
        return True
