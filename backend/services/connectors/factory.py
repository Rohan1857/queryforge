"""Factory that creates the right connector based on connection type."""

from __future__ import annotations

from backend.services.connectors.base import ConnectorError, DataConnector


class ConnectorFactory:
    _registry: dict[str, type] = {}

    @classmethod
    def register(cls, conn_type: str, connector_cls: type) -> None:
        cls._registry[conn_type] = connector_cls

    @classmethod
    def create(cls, conn_type: str, config: dict) -> DataConnector:
        # Lazy imports so only the needed driver is loaded
        if not cls._registry:
            cls._load_defaults()

        connector_cls = cls._registry.get(conn_type)
        if connector_cls is None:
            raise ConnectorError(f"Unsupported connector type: {conn_type}")
        return connector_cls(config)

    @classmethod
    def _load_defaults(cls) -> None:
        from backend.services.connectors.csv_connector import CSVConnector
        from backend.services.connectors.excel_connector import ExcelConnector
        from backend.services.connectors.gdrive import GDriveConnector
        from backend.services.connectors.json_connector import JSONConnector
        from backend.services.connectors.mysql import MySQLConnector
        from backend.services.connectors.postgres import PostgresConnector
        from backend.services.connectors.sqlite import SQLiteConnector

        cls._registry = {
            "postgres": PostgresConnector,
            "mysql": MySQLConnector,
            "sqlite": SQLiteConnector,
            "csv": CSVConnector,
            "excel": ExcelConnector,
            "json": JSONConnector,
            "gdrive": GDriveConnector,
        }
