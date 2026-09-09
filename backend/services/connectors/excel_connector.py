"""Excel file connector — each sheet becomes a DuckDB table."""

from __future__ import annotations

import os

import pandas as pd
from loguru import logger

from backend.services.connectors._duckdb_mixin import DuckDBMixin
from backend.services.connectors.base import ConnectionError


class ExcelConnector(DuckDBMixin):
    def __init__(self, config: dict) -> None:
        self._config = config
        self._file_path: str = config["file_path"]
        self._duckdb = None
        self._table_names: list[str] = []
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            xls = pd.ExcelFile(self._file_path, engine="openpyxl")
            for sheet_name in xls.sheet_names:
                df = xls.parse(sheet_name)
                df.columns = [str(c).strip().replace(" ", "_").lower() for c in df.columns]
                table_name = sheet_name.strip().replace(" ", "_").replace("-", "_").lower()
                self._register_dataframe(table_name, df)
                logger.debug(f"Excel sheet '{sheet_name}' → table '{table_name}' ({len(df)} rows)")
            self._loaded = True
        except FileNotFoundError as e:
            raise ConnectionError(f"Excel file not found: {self._file_path}") from e
        except Exception as e:
            raise ConnectionError(f"Failed to load Excel: {e}") from e

    async def test_connection(self) -> bool:
        self._load()
        return True
