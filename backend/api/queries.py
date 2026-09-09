"""Direct SQL query execution and query history API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.db.session import get_db_session
from backend.dependencies import get_current_user
from backend.middleware.rate_limiter import limiter
from backend.models.connection import DataConnection
from backend.models.llm_query_log import LLMQueryLog
from backend.models.query_log import QueryLog
from backend.models.user import User
from backend.schemas.query import QueryRequest, QueryResult
from backend.services.connectors.factory import ConnectorFactory
from backend.utils.encryption import decrypt_config
from backend.utils.sql_validator import SQLSemanticError, UnsafeQueryError, validate_sql_with_schema

router = APIRouter(prefix="/query", tags=["query"])

MAX_ROWS = 10_000


@router.post("/execute", response_model=QueryResult)
@limiter.limit("60/minute")
async def execute_query(
    request: Request,
    body: QueryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Execute a raw SQL query (SELECT only) against a connection."""
    # Get connection
    try:
        conn_uuid = uuid.UUID(body.connection_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid connection_id")

    result = await db.execute(
        select(DataConnection).where(
            DataConnection.id == conn_uuid, DataConnection.user_id == user.id
        )
    )
    db_conn = result.scalar_one_or_none()
    if db_conn is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")

    try:
        validated = validate_sql_with_schema(body.sql, db_conn.schema_cache)
    except (UnsafeQueryError, SQLSemanticError) as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    config = decrypt_config(
        db_conn.config if isinstance(db_conn.config, str) else db_conn.config,
        settings.JWT_SECRET,
    )
    connector = ConnectorFactory.create(db_conn.type, config)

    try:
        qr = await connector.execute_query(validated.validated_sql, body.params or None)
    except Exception as e:
        # Log failure
        log = QueryLog(
            user_id=user.id,
            connection_id=conn_uuid,
            prompt=body.sql,
            generated_query=validated.validated_sql,
            error=str(e),
        )
        db.add(log)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Query failed: {e}")
    finally:
        await connector.disconnect()

    # Enforce max rows
    rows = qr.rows[:MAX_ROWS]

    # Log success
    log = QueryLog(
        user_id=user.id,
        connection_id=conn_uuid,
        prompt=body.sql,
        generated_query=validated.validated_sql,
        execution_ms=qr.execution_ms,
        row_count=len(rows),
    )
    db.add(log)

    return QueryResult(
        columns=qr.columns,
        rows=rows,
        row_count=len(rows),
        execution_ms=qr.execution_ms,
    )


@router.get("/llm-history")
async def llm_query_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Return the user's last 50 LLM query logs."""
    result = await db.execute(
        select(LLMQueryLog)
        .where(LLMQueryLog.user_id == user.id)
        .order_by(LLMQueryLog.timestamp.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user_prompt": log.user_prompt,
            "generated_sql": log.generated_sql,
            "validated_sql": log.validated_sql,
            "parsed_sql_ast": log.parsed_sql_ast,
            "database_response_preview": log.database_response_preview,
            "row_count": log.row_count,
            "execution_time_ms": log.execution_time_ms,
            "error_message": log.error_message,
            "llm_model_used": log.llm_model_used,
        }
        for log in logs
    ]


@router.get("/history")
async def query_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Return the user's last 50 queries."""
    result = await db.execute(
        select(QueryLog)
        .where(QueryLog.user_id == user.id)
        .order_by(QueryLog.created_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "prompt": log.prompt,
            "generated_query": log.generated_query,
            "intent": log.intent,
            "execution_ms": log.execution_ms,
            "row_count": log.row_count,
            "error": log.error,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
