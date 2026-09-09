"""Google Drive / Google Sheets connector using gspread."""

from __future__ import annotations

import pandas as pd
from loguru import logger

from backend.services.connectors._duckdb_mixin import DuckDBMixin
from backend.services.connectors.base import ConnectionError


class GDriveConnector(DuckDBMixin):
    def __init__(self, config: dict) -> None:
        self._config = config
        self._duckdb = None
        self._table_names: list[str] = []
        self._loaded = False
        self._gc = None

    def _get_client(self):
        if self._gc is not None:
            return self._gc
        try:
            import gspread
            from google.oauth2.service_account import Credentials

            creds_data = self._config.get("credentials", {})
            scopes = [
                "https://www.googleapis.com/auth/spreadsheets.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
            ]
            credentials = Credentials.from_service_account_info(creds_data, scopes=scopes)
            self._gc = gspread.authorize(credentials)
            return self._gc
        except Exception as e:
            raise ConnectionError(f"Google Drive auth failed: {e}") from e

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            gc = self._get_client()
            spreadsheet_id = self._config["spreadsheet_id"]
            sh = gc.open_by_key(spreadsheet_id)

            sheet_name = self._config.get("sheet_name")
            worksheets = [sh.worksheet(sheet_name)] if sheet_name else sh.worksheets()

            for ws in worksheets:
                records = ws.get_all_records()
                if not records:
                    continue
                df = pd.DataFrame(records)
                df.columns = [str(c).strip().replace(" ", "_").lower() for c in df.columns]
                table_name = ws.title.strip().replace(" ", "_").replace("-", "_").lower()
                self._register_dataframe(table_name, df)
                logger.debug(f"GSheet '{ws.title}' → table '{table_name}' ({len(df)} rows)")

            self._loaded = True
        except ConnectionError:
            raise
        except Exception as e:
            raise ConnectionError(f"Failed to load Google Sheet: {e}") from e

    async def test_connection(self) -> bool:
        self._load()
        return True
