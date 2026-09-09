"""Prompt API routes — the main NL→widget interface."""

from __future__ import annotations

import json
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
from backend.models.user import User
from backend.models.widget import Widget
from backend.schemas.prompt import (
    PromptExplainRequest,
    PromptExplainResponse,
    PromptRequest,
    PromptResponse,
    PromptSuggestResponse,
)
from backend.api._helpers import widget_to_dict as _widget_response
from backend.services.connectors.factory import ConnectorFactory
from backend.services.prompt_engine.engine import PromptEngine
from backend.services.prompt_engine.schema_context import build_context
from backend.utils.encryption import decrypt_config
from backend.utils.helpers import to_json_compatible
from backend.utils.sql_validator import validate_sql

router = APIRouter(prefix="/prompt", tags=["prompt"])

# Singleton engine instance
_engine = PromptEngine()


@router.post("", response_model=PromptResponse)
@limiter.limit("30/minute")
async def process_prompt(
    body: PromptRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Convert a natural language prompt into a widget."""
    try:
        result = await _engine.process_prompt(body, str(user.id), db)
    except Exception as e:
        logger.error(f"Prompt processing failed: {e}")
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    # Emit WebSocket event if dashboard_id was provided
    if body.dashboard_id and result.widget.id:
        sio = getattr(request.app.state, "sio", None)
        if sio:
            widget = await db.get(Widget, uuid.UUID(result.widget.id))
            await sio.emit(
                "widget:created",
                _widget_response(widget) if widget else {"id": result.widget.id},
                room=body.dashboard_id,
                namespace="/dashboard",
            )

    return result


@router.post("/explain", response_model=PromptExplainResponse)
async def explain_prompt(
    body: PromptExplainRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Answer a data question without creating a widget."""
    from backend.services.llm_client import get_llm_client

    client = get_llm_client()

    # Validate and verify connection ownership if connection_id provided
    db_conn = None
    if body.connection_id:
        try:
            conn_uuid = uuid.UUID(body.connection_id)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid connection_id")

        result = await db.execute(
            select(DataConnection).where(
                DataConnection.id == conn_uuid,
                DataConnection.user_id == user.id,
            )
        )
        db_conn = result.scalar_one_or_none()
        if not db_conn:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")

    # Build schema context only for verified owned connection
    conn_ids = [str(db_conn.id)] if db_conn else []
    schema_ctx = await build_context(conn_ids, db, prompt=body.prompt)

    # Call LLM with an analyst persona
    response = await client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=2048,
        system=(
            "You are a data analyst. Answer the user's question about their data.\n"
            "First generate a SQL query, then provide a clear natural language answer.\n\n"
            f"DATABASE SCHEMA:\n{schema_ctx}\n\n"
            "Respond with JSON: {\"sql\": \"...\", \"answer\": \"...\"}"
        ),
        messages=[{"role": "user", "content": body.prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return PromptExplainResponse(answer=raw, query_used="", data=[])

    sql = parsed.get("sql", "")
    answer = parsed.get("answer", raw)

    # Execute the SQL if we have an authorized connection
    data: list[dict] = []
    if sql and db_conn:
        try:
            validate_sql(sql)
            config = decrypt_config(db_conn.config, settings.JWT_SECRET)
            connector = ConnectorFactory.create(db_conn.type, config)
            try:
                qr = await connector.execute_query(sql)
                data = qr.rows
            finally:
                await connector.disconnect()
        except Exception as e:
            logger.warning(f"Explain query execution failed: {e}")

    return PromptExplainResponse(answer=answer, query_used=sql, data=data)


@router.post("/suggest", response_model=PromptSuggestResponse)
async def suggest_prompts(
    body: dict,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Generate prompt suggestions based on a connection's schema."""
    connection_id = body.get("connection_id")
    if not connection_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "connection_id required")

    try:
        conn_uuid = uuid.UUID(connection_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid connection_id")

    result = await db.execute(
        select(DataConnection).where(
            DataConnection.id == conn_uuid,
            DataConnection.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found")

    # Check Redis cache first
    redis = getattr(request.app.state, "redis", None)
    cache_key = f"suggestions:{connection_id}"
    if redis:
        cached = await redis.get(cache_key)
        if cached:
            return PromptSuggestResponse(suggestions=json.loads(cached))

    # Build schema context
    schema_ctx = await build_context([connection_id], db)

    from backend.services.llm_client import get_llm_client

    client = get_llm_client()
    response = await client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=512,
        system=(
            "Given this database schema, suggest 10 interesting BI questions "
            "a business user might ask. Format as a JSON array of strings.\n\n"
            f"SCHEMA:\n{schema_ctx}"
        ),
        messages=[{"role": "user", "content": "Suggest BI questions"}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = [raw]
    except json.JSONDecodeError:
        suggestions = [raw]

    # Cache in Redis for 10 minutes
    if redis:
        await redis.setex(cache_key, 600, json.dumps(suggestions))

    return PromptSuggestResponse(suggestions=suggestions[:10])


@router.post("/modify", response_model=PromptResponse)
async def modify_widget(
    body: dict,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Modify an existing widget based on a natural language instruction."""
    widget_id = body.get("widget_id")
    modification_prompt = body.get("modification_prompt")
    if not widget_id or not modification_prompt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "widget_id and modification_prompt required")

    # Fetch existing widget with user ownership check
    try:
        w_uuid = uuid.UUID(widget_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid widget_id")

    from backend.services.widget_service import get_widget_with_access_check

    widget = await get_widget_with_access_check(w_uuid, user.id, db)
    if widget is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Widget not found")

    original_sql = widget.query_config.get("sql", "") if widget.query_config else ""
    connection_id = str(widget.connection_id) if widget.connection_id else None

    # Use dedicated modify path — skips intent classification
    try:
        response = await _engine.modify_prompt(
            original_sql=original_sql,
            modification_prompt=modification_prompt,
            connection_id=connection_id,
            dashboard_id=str(widget.dashboard_id),
            user_id=str(user.id),
            db_session=db,
        )
    except Exception as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    # Update the existing widget in DB
    widget.query_config = {"sql": response.query_info.sql, "params": response.query_info.params}
    widget.chart_config = response.widget.chart_config.model_dump()
    widget.title = response.widget.title
    widget.cached_data = {"rows": to_json_compatible(response.widget.data)}
    await db.flush()
    await db.refresh(widget)
    response.widget.id = str(widget.id)

    # Emit WebSocket event
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit(
            "widget:updated",
            _widget_response(widget),
            room=str(widget.dashboard_id),
            namespace="/dashboard",
        )

    return response
