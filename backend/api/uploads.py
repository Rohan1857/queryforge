"""File upload API — accepts CSV, Excel, JSON and auto-creates connections."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.session import get_db_session
from backend.dependencies import get_current_user
from backend.models.connection import DataConnection
from backend.models.user import User
from backend.schemas.connection import ConnectionRead
from backend.services.connectors.factory import ConnectorFactory

router = APIRouter(prefix="/upload", tags=["upload"])

_ALLOWED_TYPES = {
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "application/vnd.ms-excel": "excel",
    "application/json": "json",
    # Browser sometimes sends these
    "application/octet-stream": None,  # detect from extension
}

_EXT_MAP = {
    ".csv": "csv",
    ".xlsx": "excel",
    ".xls": "excel",
    ".json": "json",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("", response_model=ConnectionRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    # Determine file type
    content_type = file.content_type or ""
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    conn_type = _ALLOWED_TYPES.get(content_type) or _EXT_MAP.get(file_ext)

    if conn_type is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type: {content_type} / {file_ext}. "
            "Accepted: CSV, XLSX, JSON",
        )

    # Read and validate size
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds 50MB limit")

    # Save to disk
    user_dir = os.path.join(settings.UPLOAD_DIR, str(user.id))
    os.makedirs(user_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(user_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(data)
    logger.info(f"File uploaded: {file_path} ({len(data)} bytes)")

    # Parse schema immediately
    config = {
        "file_path": file_path,
        "file_name": file.filename,
        "file_type": conn_type,
    }
    connector = ConnectorFactory.create(conn_type, config)
    try:
        await connector.test_connection()
        schema = await connector.get_schema()
    except Exception as e:
        # Clean up on failure
        os.remove(file_path)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Failed to parse file: {e}")
    finally:
        await connector.disconnect()

    # Create DB record
    conn = DataConnection(
        user_id=user.id,
        name=file.filename or "Uploaded file",
        type=conn_type,
        config=config,
        schema_cache=schema.model_dump(),
        status="active",
        last_synced=datetime.now(timezone.utc),
    )
    db.add(conn)
    await db.flush()
    await db.refresh(conn)
    return conn
