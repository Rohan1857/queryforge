"""Build a compact schema context string for the Claude prompt."""

from __future__ import annotations

import json
import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.connection import DataConnection
from backend.schemas.connection import SchemaMetadata

# Max tokens budget for schema context (rough char estimate: 1 token ≈ 4 chars)
_MAX_CHARS = 8000


def _format_schema(conn_name: str, conn_type: str, schema: SchemaMetadata) -> str:
    """Format a single connection's schema as a compact string."""
    lines = [f"=== Connection: {conn_name} ({conn_type}) ==="]

    for table in schema.tables:
        lines.append(f"  Table: {table.name} ({table.row_count:,} rows)")
        for col in table.columns:
            parts = [f"    {col.name}: {col.type}"]
            flags = []
            if col.is_primary_key:
                flags.append("PK")
            if col.is_foreign_key:
                flags.append("FK")
            if flags:
                parts.append(f" ({', '.join(flags)})")
            if col.sample_values:
                samples = ", ".join(f"'{v}'" for v in col.sample_values[:3])
                parts.append(f" [samples: {samples}]")
            lines.append("".join(parts))

        # Show relationships
        for rel in table.relationships:
            lines.append(f"    → {rel['column']} references {rel['references']}")

    return "\n".join(lines)


def _fuzzy_relevant(table_name: str, columns: list[str], prompt: str) -> bool:
    """Check if a table/column name is mentioned or closely related to the prompt."""
    prompt_lower = prompt.lower()
    if table_name.lower() in prompt_lower:
        return True
    for col in columns:
        if col.lower() in prompt_lower:
            return True
    return False


async def build_context(
    connection_ids: list[str],
    db_session: AsyncSession,
    prompt: str = "",
) -> str:
    """Fetch schemas for the given connections and format them compactly.

    If the total context exceeds the budget, prioritize tables
    that fuzzy-match the user's prompt.
    """
    uuids = []
    for cid in connection_ids:
        try:
            uuids.append(uuid.UUID(cid))
        except ValueError:
            logger.warning(f"Invalid connection ID skipped: {cid}")

    if not uuids:
        return "No database connections provided."

    result = await db_session.execute(
        select(DataConnection).where(DataConnection.id.in_(uuids))
    )
    connections = result.scalars().all()

    if not connections:
        return "No matching connections found."

    # Build full context
    sections: list[str] = []
    for conn in connections:
        if not conn.schema_cache:
            sections.append(f"=== Connection: {conn.name} ({conn.type}) ===\n  (no schema cached)")
            continue

        schema_data = conn.schema_cache
        if isinstance(schema_data, str):
            schema_data = json.loads(schema_data)
        schema = SchemaMetadata.model_validate(schema_data)

        # If prompt provided and schema is large, filter to relevant tables
        if prompt and len(schema.tables) > 5:
            relevant = [
                t for t in schema.tables
                if _fuzzy_relevant(t.name, [c.name for c in t.columns], prompt)
            ]
            # Always include at least top 5 tables even if no fuzzy match
            if not relevant:
                relevant = schema.tables[:5]
            schema = SchemaMetadata(tables=relevant)

        sections.append(_format_schema(conn.name, conn.type, schema))

    full_context = "\n\n".join(sections)

    # Truncate if too large
    if len(full_context) > _MAX_CHARS:
        full_context = full_context[:_MAX_CHARS] + "\n... (schema truncated)"

    return full_context
