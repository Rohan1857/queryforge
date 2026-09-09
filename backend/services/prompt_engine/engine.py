"""Main Prompt Engine orchestrator — converts natural language to widgets."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models.connection import DataConnection
from backend.models.llm_query_log import LLMQueryLog
from backend.models.query_log import QueryLog
from backend.models.widget import Widget
from backend.schemas.prompt import PromptRequest, PromptResponse, QueryInfo
from backend.services.connectors.factory import ConnectorFactory
from backend.services.prompt_engine import (
    chart_recommender,
    intent_classifier,
    prompt_optimizer,
    query_generator,
    schema_context,
    widget_builder,
)
from backend.utils.encryption import decrypt_config
from backend.utils.helpers import to_json_compatible
from backend.utils.sql_validator import (
    SQLSemanticError,
    UnsafeQueryError,
    ValidatedSQL,
    validate_sql_with_schema,
)


class PromptEngine:
    def _get_claude(self):
        """Return the LLM client (OpenRouter adapter)."""
        from backend.services.llm_client import get_llm_client

        return get_llm_client()

    async def process_prompt(
        self,
        request: PromptRequest,
        user_id: str,
        db_session: AsyncSession,
    ) -> PromptResponse:
        """Full pipeline: NL prompt → classified intent → SQL → execution → widget."""
        claude = self._get_claude()
        intent = await intent_classifier.classify_with_fallback(request.prompt, claude)
        logger.info(f"Intent: {intent}")

        connection = await self._resolve_connection(
            connection_id=request.connection_id,
            dashboard_id=request.dashboard_id,
            user_id=user_id,
            db_session=db_session,
        )
        effective_connection_id = str(connection.id)
        effective_request = PromptRequest(
            prompt=request.prompt,
            connection_id=effective_connection_id,
            dashboard_id=request.dashboard_id,
        )

        schema_ctx = await schema_context.build_context(
            [effective_connection_id],
            db_session,
            prompt=request.prompt,
        )
        optimized_prompt = prompt_optimizer.optimize_prompt(request.prompt, schema_ctx, intent)

        generation, validated_sql, query_result_rows, execution_ms, query_error = (
            await self._generate_execute_with_repair(
                prompt_for_llm=optimized_prompt,
                user_prompt=request.prompt,
                schema_context_text=schema_ctx,
                schema_cache=connection.schema_cache if connection else None,
                intent=intent,
                connection=connection,
                claude_client=claude,
            )
        )

        if query_error:
            logger.error(f"Query execution error: {query_error}")
            generation.explanation = (
                f"Query could not be executed. {query_error}. "
                "Try rephrasing your question."
            )
            query_result_rows = []
        elif not query_result_rows:
            logger.warning("Query returned no rows")

        if query_result_rows and generation.chart_config:
            generation.chart_config = _validate_and_fix_chart_config(
                generation.chart_config,
                query_result_rows,
            )

        existing_positions: list[dict[str, Any]] = []
        if request.dashboard_id:
            dashboard_uuid = uuid.UUID(request.dashboard_id)
            result = await db_session.execute(
                select(Widget.layout_position).where(Widget.dashboard_id == dashboard_uuid)
            )
            existing_positions = [layout or {} for layout in result.scalars().all()]

        recommended_chart = chart_recommender.recommend(query_result_rows, intent=intent)
        chart_type = (
            recommended_chart
            if recommended_chart in {"kpi", "line", "scatter"}
            else generation.chart_type
        )

        widget_result = widget_builder.build_widget(
            prompt=request.prompt,
            query_result=query_result_rows,
            chart_type=chart_type,
            chart_config=generation.chart_config,
            title=generation.title,
            explanation=generation.explanation,
            connection_id=effective_connection_id,
            dashboard_id=request.dashboard_id,
            existing_positions=existing_positions,
            sql=validated_sql.validated_sql if validated_sql else generation.sql,
            params=generation.params,
        )

        await self._log_query(
            db_session=db_session,
            user_id=user_id,
            request=effective_request,
            intent=intent,
            generated_sql=generation.sql,
            validated_sql=validated_sql.validated_sql if validated_sql else None,
            parsed_sql_ast=validated_sql.parsed_sql_ast if validated_sql else None,
            preview_rows=query_result_rows,
            execution_ms=execution_ms,
            row_count=len(query_result_rows),
            error=query_error,
        )

        if request.dashboard_id:
            db_widget = Widget(
                dashboard_id=uuid.UUID(request.dashboard_id),
                connection_id=connection.id,
                type=chart_type,
                title=generation.title,
                prompt_used=request.prompt,
                query_config={
                    "sql": validated_sql.validated_sql if validated_sql else generation.sql,
                    "params": generation.params or [],
                },
                chart_config=widget_result.chart_config.model_dump(),
                layout_position=widget_result.layout_position.model_dump(),
                cached_data={"rows": to_json_compatible(query_result_rows)},
            )
            db_session.add(db_widget)
            await db_session.flush()
            await db_session.refresh(db_widget)
            widget_result.id = str(db_widget.id)

        return PromptResponse(
            widget=widget_result,
            query_info=QueryInfo(
                sql=validated_sql.validated_sql if validated_sql else generation.sql,
                params=generation.params or [],
                execution_ms=execution_ms,
                row_count=len(query_result_rows),
            ),
            explanation=generation.explanation,
        )

    async def modify_prompt(
        self,
        *,
        original_sql: str,
        modification_prompt: str,
        connection_id: str | None,
        dashboard_id: str | None,
        user_id: str,
        db_session: AsyncSession,
    ) -> PromptResponse:
        """Modify an existing query and re-execute it."""
        claude = self._get_claude()
        intent = "modify"
        connection = await self._resolve_connection(
            connection_id=connection_id,
            dashboard_id=dashboard_id,
            user_id=user_id,
            db_session=db_session,
        )
        effective_connection_id = str(connection.id)
        schema_ctx = await schema_context.build_context(
            [effective_connection_id],
            db_session,
            prompt=modification_prompt,
        )

        combined_prompt = (
            f"Here is an existing SQL query:\n```sql\n{original_sql}\n```\n\n"
            f"Modify it as follows: {modification_prompt}"
        )

        generation, validated_sql, query_result_rows, execution_ms, query_error = (
            await self._generate_execute_with_repair(
                prompt_for_llm=combined_prompt,
                user_prompt=modification_prompt,
                schema_context_text=schema_ctx,
                schema_cache=connection.schema_cache if connection else None,
                intent=intent,
                connection=connection,
                claude_client=claude,
            )
        )

        if query_error:
            generation.explanation = (
                f"Query could not be executed. {query_error}. "
                "Try rephrasing your modification."
            )
            query_result_rows = []

        if query_result_rows and generation.chart_config:
            generation.chart_config = _validate_and_fix_chart_config(
                generation.chart_config,
                query_result_rows,
            )

        widget_result = widget_builder.build_widget(
            prompt=modification_prompt,
            query_result=query_result_rows,
            chart_type=generation.chart_type,
            chart_config=generation.chart_config,
            title=generation.title,
            explanation=generation.explanation,
            connection_id=effective_connection_id,
            dashboard_id=dashboard_id,
            sql=validated_sql.validated_sql if validated_sql else generation.sql,
            params=generation.params,
        )

        fake_request = PromptRequest(
            prompt=modification_prompt,
            connection_id=effective_connection_id,
            dashboard_id=dashboard_id,
        )
        await self._log_query(
            db_session=db_session,
            user_id=user_id,
            request=fake_request,
            intent=intent,
            generated_sql=generation.sql,
            validated_sql=validated_sql.validated_sql if validated_sql else None,
            parsed_sql_ast=validated_sql.parsed_sql_ast if validated_sql else None,
            preview_rows=query_result_rows,
            execution_ms=execution_ms,
            row_count=len(query_result_rows),
            error=query_error,
        )

        return PromptResponse(
            widget=widget_result,
            query_info=QueryInfo(
                sql=validated_sql.validated_sql if validated_sql else generation.sql,
                params=generation.params or [],
                execution_ms=execution_ms,
                row_count=len(query_result_rows),
            ),
            explanation=generation.explanation,
        )

    async def _get_connection(
        self,
        connection_id: str | None,
        user_id: str | None,
        db_session: AsyncSession,
    ) -> DataConnection | None:
        if not connection_id:
            return None

        user_uuid = uuid.UUID(user_id) if user_id else None
        conn_uuid = uuid.UUID(connection_id)
        stmt = select(DataConnection).where(DataConnection.id == conn_uuid)
        if user_uuid is not None:
            stmt = stmt.where(DataConnection.user_id == user_uuid)
        result = await db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def _resolve_connection(
        self,
        *,
        connection_id: str | None,
        dashboard_id: str | None,
        user_id: str,
        db_session: AsyncSession,
    ) -> DataConnection:
        if connection_id:
            connection = await self._get_connection(connection_id, user_id, db_session)
            if connection is None:
                raise QueryError("Connection not found")
            return connection

        dashboard_connection = await self._get_dashboard_connection(
            dashboard_id=dashboard_id,
            user_id=user_id,
            db_session=db_session,
        )
        if dashboard_connection is not None:
            return dashboard_connection

        raise QueryError("Select a data source before prompting.")

    async def _get_dashboard_connection(
        self,
        *,
        dashboard_id: str | None,
        user_id: str,
        db_session: AsyncSession,
    ) -> DataConnection | None:
        if not dashboard_id:
            return None

        from sqlalchemy import distinct

        from backend.models.dashboard import Dashboard

        dashboard_uuid = uuid.UUID(dashboard_id)
        user_uuid = uuid.UUID(user_id)

        dashboard_result = await db_session.execute(
            select(Dashboard).where(Dashboard.id == dashboard_uuid, Dashboard.user_id == user_uuid)
        )
        dashboard = dashboard_result.scalar_one_or_none()
        if dashboard is None:
            raise QueryError("Dashboard not found")

        connection_result = await db_session.execute(
            select(distinct(Widget.connection_id))
            .where(Widget.dashboard_id == dashboard_uuid, Widget.connection_id.is_not(None))
        )
        connection_ids = [connection_id for connection_id in connection_result.scalars().all() if connection_id]

        if not connection_ids:
            return None

        if len(connection_ids) > 1:
            raise QueryError("This dashboard uses multiple data sources. Select one before prompting.")

        return await self._get_connection(str(connection_ids[0]), user_id, db_session)

    async def _generate_execute_with_repair(
        self,
        *,
        prompt_for_llm: str,
        user_prompt: str,
        schema_context_text: str,
        schema_cache: dict | None,
        intent: str,
        connection: DataConnection | None,
        claude_client,
    ) -> tuple[query_generator.GeneratedQuery, ValidatedSQL | None, list[dict], int, str | None]:
        generation = await query_generator.generate(
            prompt_for_llm,
            schema_context_text,
            intent,
            claude_client,
        )

        last_error: str | None = None
        validated_sql: ValidatedSQL | None = None
        query_result_rows: list[dict] = []
        execution_ms = 0
        query_error: str | None = None

        for attempt in range(2):
            try:
                validated_sql = validate_sql_with_schema(generation.sql, schema_cache)
            except (UnsafeQueryError, SQLSemanticError) as exc:
                last_error = str(exc)
                parsed_sql_ast = getattr(exc, "parsed_sql_ast", None)
                self._emit_query_debug_console(
                    generated_sql=generation.sql,
                    parsed_sql_ast=parsed_sql_ast,
                    row_count=0,
                    execution_ms=0,
                    error=last_error,
                )
                if attempt == 0:
                    generation = await query_generator.repair(
                        prompt=prompt_for_llm,
                        schema_context=schema_context_text,
                        intent=intent,
                        previous_sql=generation.sql,
                        feedback=f"Validation failed: {last_error}",
                        claude_client=claude_client,
                    )
                    continue
                raise

            query_result_rows, execution_ms, query_error = await self._execute_query(
                connection,
                validated_sql.validated_sql,
                generation.params or None,
            )
            self._emit_query_debug_console(
                generated_sql=generation.sql,
                parsed_sql_ast=validated_sql.parsed_sql_ast,
                row_count=len(query_result_rows),
                execution_ms=execution_ms,
                error=query_error,
            )

            if query_error and attempt == 0:
                generation = await query_generator.repair(
                    prompt=prompt_for_llm,
                    schema_context=schema_context_text,
                    intent=intent,
                    previous_sql=validated_sql.validated_sql,
                    feedback=f"Database execution error: {query_error}",
                    claude_client=claude_client,
                )
                continue

            if (
                not query_error
                and not query_result_rows
                and attempt == 0
                and _prompt_mentions_timeframe(user_prompt)
            ):
                generation = await query_generator.repair(
                    prompt=prompt_for_llm,
                    schema_context=schema_context_text,
                    intent=intent,
                    previous_sql=validated_sql.validated_sql,
                    feedback=(
                        "The query executed successfully but returned zero rows. "
                        "Re-check date filters, month grouping, and metric columns. "
                        "For DATE/TIMESTAMP columns, use ISO boundaries instead of month names."
                    ),
                    claude_client=claude_client,
                )
                continue

            return generation, validated_sql, query_result_rows, execution_ms, query_error

        if last_error:
            raise QueryError(last_error)

        return generation, validated_sql, query_result_rows, execution_ms, query_error

    async def _execute_query(
        self,
        connection: DataConnection | None,
        sql: str,
        params: list[Any] | None,
    ) -> tuple[list[dict], int, str | None]:
        if connection is None:
            return [], 0, None

        config = decrypt_config(connection.config, settings.JWT_SECRET)
        connector = ConnectorFactory.create(connection.type, config)
        try:
            result = await connector.execute_query(sql, params)
            return result.rows, result.execution_ms, None
        except Exception as exc:
            logger.warning(f"Query execution failed: {exc}")
            return [], 0, str(exc)
        finally:
            await connector.disconnect()

    async def _log_query(
        self,
        *,
        db_session: AsyncSession,
        user_id: str,
        request: PromptRequest,
        intent: str,
        generated_sql: str,
        validated_sql: str | None,
        parsed_sql_ast: str | None,
        preview_rows: list[dict],
        execution_ms: int,
        row_count: int,
        error: str | None,
    ) -> None:
        user_uuid = uuid.UUID(user_id)
        connection_uuid = uuid.UUID(request.connection_id) if request.connection_id else None

        query_log = QueryLog(
            user_id=user_uuid,
            connection_id=connection_uuid,
            prompt=request.prompt,
            generated_query=validated_sql or generated_sql,
            intent=intent,
            execution_ms=execution_ms,
            row_count=row_count,
            error=error,
        )
        db_session.add(query_log)

        llm_log = LLMQueryLog(
            user_id=user_uuid,
            connection_id=connection_uuid,
            user_prompt=request.prompt,
            generated_sql=generated_sql,
            validated_sql=validated_sql,
            parsed_sql_ast=parsed_sql_ast,
            database_response_preview=_serialize_preview(preview_rows),
            row_count=row_count,
            execution_time_ms=execution_ms,
            error_message=error,
            llm_model_used=settings.LLM_MODEL,
        )
        db_session.add(llm_log)
        await db_session.flush()

        if parsed_sql_ast:
            logger.debug(f"Parsed SQL AST: {parsed_sql_ast}")

    def _emit_query_debug_console(
        self,
        *,
        generated_sql: str,
        parsed_sql_ast: str | None,
        row_count: int,
        execution_ms: int,
        error: str | None,
    ) -> None:
        logger.info(f"Generated SQL: {generated_sql}")
        if parsed_sql_ast:
            logger.info(f"Parsed SQL AST: {parsed_sql_ast}")
        logger.info(f"Database response size: {row_count} rows")
        logger.info(f"Query execution time: {execution_ms} ms")
        if error:
            logger.warning(f"Query debug error: {error}")


class QueryError(Exception):
    """Prompt-engine level query validation or execution failure."""


def _prompt_mentions_timeframe(prompt: str) -> bool:
    return bool(
        re.search(
            r"\b(month|quarter|year|date|between|from|to|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|202\d)\b",
            prompt.lower(),
        )
    )


def _serialize_preview(rows: list[dict]) -> str:
    preview = rows[:5]
    return json.dumps(to_json_compatible(preview)) if preview else "[]"


def _validate_and_fix_chart_config(
    chart_config: dict,
    rows: list[dict],
) -> dict:
    """Validate chart_config fields against actual query result columns."""
    if not rows:
        return chart_config

    chart_config = dict(chart_config or {})
    actual_cols = set(rows[0].keys())
    x_field = chart_config.get("x_field") or ""
    raw_y_fields = chart_config.get("y_fields")
    if isinstance(raw_y_fields, list):
        y_fields = [field for field in raw_y_fields if field]
    elif raw_y_fields:
        y_fields = [raw_y_fields]
    else:
        y_fields = []
    sample_row = rows[0]
    string_cols = [col for col in actual_cols if isinstance(sample_row.get(col), str)]
    numeric_cols = [
        col for col in actual_cols if isinstance(sample_row.get(col), (int, float))
    ]
    lower_map = {col.lower(): col for col in actual_cols}

    if not x_field:
        if string_cols:
            chart_config["x_field"] = string_cols[0]
        elif numeric_cols:
            chart_config["x_field"] = numeric_cols[0]
        elif actual_cols:
            chart_config["x_field"] = next(iter(actual_cols))
        x_field = chart_config.get("x_field", "")

    if x_field and x_field not in actual_cols:
        if x_field.lower() in lower_map:
            chart_config["x_field"] = lower_map[x_field.lower()]
        elif string_cols:
            chart_config["x_field"] = string_cols[0]
        elif actual_cols:
            fallback = next((col for col in actual_cols if col not in numeric_cols), None)
            chart_config["x_field"] = fallback or next(iter(actual_cols))

    if y_fields:
        valid_y = [field for field in y_fields if field in actual_cols]
        if not valid_y:
            valid_y = [lower_map[field.lower()] for field in y_fields if field.lower() in lower_map]
        if not valid_y and numeric_cols:
            valid_y = numeric_cols[:3]
        if valid_y:
            chart_config["y_fields"] = valid_y
    elif numeric_cols:
        chart_config["y_fields"] = numeric_cols[:3]

    return chart_config
