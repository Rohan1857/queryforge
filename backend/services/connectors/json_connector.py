"""JSON file connector — flattens nested objects, loads into DuckDB."""

from __future__ import annotations

import os

import pandas as pd
from loguru import logger

from backend.services.connectors._duckdb_mixin import DuckDBMixin
from backend.services.connectors.base import ConnectionError


class JSONConnector(DuckDBMixin):
    def __init__(self, config: dict) -> None:
        self._config = config
        self._file_path: str = config["file_path"]
        raw_name = (
            os.path.splitext(os.path.basename(self._file_path))[0]
            .replace(" ", "_")
            .replace("-", "_")
            .lower()
        )
        # Strip UUID prefix (e.g. "ab12cd34_demo_data" → "demo_data")
        parts = raw_name.split("_", 1)
        if len(parts) == 2 and len(parts[0]) == 32 and all(c in "0123456789abcdef" for c in parts[0]):
            raw_name = parts[1]
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
            # Try reading as array of records first
            try:
                df = pd.read_json(self._file_path)
            except ValueError:
                # Fallback: try json_normalize for nested structures
                import json

                with open(self._file_path) as f:
                    data = json.load(f)

                if isinstance(data, list):
                    df = pd.json_normalize(data, sep="_")
                elif isinstance(data, dict):
                    # Could be a single record or a wrapper like {"data": [...]}
                    for key, val in data.items():
                        if isinstance(val, list) and val and isinstance(val[0], dict):
                            df = pd.json_normalize(val, sep="_")
                            break
                    else:
                        df = pd.json_normalize([data], sep="_")

            # Clean column names: dots and spaces → underscores
            df.columns = [
                str(c).strip().replace(".", "_").replace(" ", "_").lower()
                for c in df.columns
            ]
            self._register_dataframe(self._table_name, df)
            self._loaded = True
            logger.debug(f"JSON loaded: {self._file_path} → table '{self._table_name}' ({len(df)} rows)")
        except FileNotFoundError as e:
            raise ConnectionError(f"JSON file not found: {self._file_path}") from e
        except Exception as e:
            raise ConnectionError(f"Failed to load JSON: {e}") from e

    async def test_connection(self) -> bool:
        self._load()
        return True
