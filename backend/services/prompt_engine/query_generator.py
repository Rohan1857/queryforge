"""Generate SQL queries from natural language using Claude API."""

from __future__ import annotations

import json
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field

_SYSTEM_PROMPT = """You are a SQL query generator for a Business Intelligence system.
Given a user's natural language request and the database schema below,
generate a response.

DATABASE SCHEMA:
{schema_context}

CRITICAL RULES — FOLLOW EXACTLY:
1. Generate ONLY SELECT queries. Never INSERT/UPDATE/DELETE/DROP.
2. Use standard SQL compatible with DuckDB/PostgreSQL.
3. ONLY use table names and column names that appear in the DATABASE SCHEMA above.
   NEVER invent or guess table/column names. If a [MATCHED COLUMNS] hint is provided,
   prefer those columns. If the user asks for a column that doesn't exist, pick the
   closest matching column from the schema and explain in your title what you used.
4. Always alias aggregated columns with human-readable names using AS.
   Alias names must be simple identifiers (letters, digits, underscores only).
5. For time series data, ORDER BY date/time column ASC.
6. For rankings/top-N, ORDER BY metric DESC with LIMIT.
7. For KPIs (single metric), return exactly one row with one numeric value.
8. Include GROUP BY when using aggregations (SUM, COUNT, AVG, etc.).
9. When the user asks for months, date ranges, or time windows, use the actual
   date/datetime column from the schema and filter with ISO dates like
   '2024-03-01' and '2024-12-31'. Never compare a date column to month names
   like 'March' unless the schema explicitly has a textual month column.
10. If a schema column is string-like but its sample values look like ISO dates,
   CAST it to DATE before filtering or grouping.
11. For monthly trends, group with DATE_TRUNC('month', <date_column>) and alias
   that grouped value as month.
12. chart_type MUST be one of: bar, line, pie, donut, area, scatter, heatmap,
    radar, histogram, stacked_bar, table, kpi.
   Choose the most appropriate type for the data shape.
13. x_field and y_fields in chart_config MUST exactly match the column aliases
    you used in your SELECT clause. Double-check this before responding.
14. If the query has a GROUP BY, x_field should be the grouped column
    and y_fields should be the aggregated column(s).
15. Use double quotes around column names that contain spaces or special characters.

Respond ONLY with valid JSON (no markdown, no code fences, no explanation outside JSON):
{{
  "sql": "SELECT ...",
  "params": [],
  "chart_type": "bar",
  "chart_config": {{
    "x_field": "column_alias_from_select",
    "y_fields": ["numeric_column_alias"],
    "group_field": null,
    "aggregation": "sum"
  }},
  "title": "Short Descriptive Title",
  "explanation": "Brief explanation of what this query does"
}}"""


class GeneratedQuery(BaseModel):
    sql: str
    params: list[Any] = Field(default_factory=list)
    chart_type: str = "bar"
    chart_config: dict = Field(default_factory=dict)
    title: str = "Query Result"
    explanation: str = ""


class QueryGenerationError(Exception):
    """Claude couldn't generate a valid query."""


_ALLOWED_CHART_TYPES = {
    "bar",
    "line",
    "pie",
    "donut",
    "area",
    "scatter",
    "heatmap",
    "radar",
    "histogram",
    "stacked_bar",
    "table",
    "kpi",
}


async def _run_generation(
    *,
    system: str,
    user_msg: str,
    claude_client,
) -> GeneratedQuery:
    for attempt in range(2):  # Retry once on malformed response
        try:
            from backend.config import settings
            response = await claude_client.messages.create(
                model=settings.LLM_MODEL,
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw_text = response.content[0].text.strip()
            raw_text = _extract_json(raw_text)

            data = json.loads(raw_text)
            result = GeneratedQuery.model_validate(data)

            if result.chart_type not in _ALLOWED_CHART_TYPES:
                logger.warning(f"Invalid chart_type '{result.chart_type}', defaulting to 'bar'")
                result.chart_type = "bar"

            logger.info(f"Query generated: {result.title}")
            return result

        except json.JSONDecodeError:
            if attempt == 0:
                logger.warning("Claude returned non-JSON, retrying...")
                continue
            raise QueryGenerationError(
                f"Claude returned invalid JSON after 2 attempts: {raw_text[:200]}"
            )
        except Exception as e:
            if attempt == 0:
                logger.warning(f"Query generation attempt failed: {e}, retrying...")
                continue
            raise QueryGenerationError(f"Failed to generate query: {e}") from e

    raise QueryGenerationError("Query generation failed after retries")


async def generate(
    prompt: str,
    schema_context: str,
    intent: str,
    claude_client,
) -> GeneratedQuery:
    """Call Claude API to generate a SQL query from natural language."""
    system = _SYSTEM_PROMPT.format(schema_context=schema_context)
    user_msg = f"Intent: {intent}\nUser request: {prompt}"
    return await _run_generation(system=system, user_msg=user_msg, claude_client=claude_client)


async def repair(
    *,
    prompt: str,
    schema_context: str,
    intent: str,
    previous_sql: str,
    feedback: str,
    claude_client,
) -> GeneratedQuery:
    """Retry generation with concrete validation or execution feedback."""
    system = _SYSTEM_PROMPT.format(schema_context=schema_context)
    user_msg = (
        f"Intent: {intent}\n"
        f"Original user request: {prompt}\n\n"
        "The previous SQL was rejected or produced unusable results.\n"
        f"Previous SQL:\n{previous_sql}\n\n"
        f"Feedback to fix:\n{feedback}\n\n"
        "Return corrected JSON only. Preserve the user's requested metric, filters, "
        "and time range, but fix any invalid columns, tables, or date filters."
    )
    return await _run_generation(system=system, user_msg=user_msg, claude_client=claude_client)


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response, stripping markdown fences and preamble."""
    # Strip markdown code fences
    if "```" in text:
        # Find content between first ``` and last ```
        parts = text.split("```")
        if len(parts) >= 3:
            inner = parts[1]
            # Remove language tag (e.g., "json\n")
            if inner.startswith(("json", "JSON")):
                inner = inner[4:]
            text = inner.strip()
        elif text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

    # If text doesn't start with {, try to find JSON object
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]

    return text.strip()
