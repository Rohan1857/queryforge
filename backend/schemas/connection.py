import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class DatabaseConfig(BaseModel):
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl: bool = False


class GDriveConfig(BaseModel):
    spreadsheet_id: str
    sheet_name: Optional[str] = None
    credentials: dict


class FileConfig(BaseModel):
    file_path: str
    file_name: str
    file_type: str


class ColumnMetadata(BaseModel):
    name: str
    type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    sample_values: list[str] = Field(default_factory=list)


class TableMetadata(BaseModel):
    name: str
    columns: list[ColumnMetadata]
    row_count: int
    relationships: list[dict] = Field(default_factory=list)


class SchemaMetadata(BaseModel):
    tables: list[TableMetadata]


class ConnectionCreate(BaseModel):
    name: str = Field(..., max_length=255)
    type: Literal["postgres", "mysql", "sqlite", "gdrive", "csv", "excel", "json"]
    config: dict


class ConnectionRead(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    status: str
    schema_cache: Optional[SchemaMetadata] = None
    last_synced: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("schema_cache", mode="before")
    @classmethod
    def coerce_schema_cache(cls, v):
        if v is None:
            return None
        if isinstance(v, SchemaMetadata):
            return v
        try:
            return SchemaMetadata.model_validate(v)
        except Exception:
            return None


class ConnectionTest(BaseModel):
    success: bool
    message: str
    schema_info: Optional[SchemaMetadata] = None
