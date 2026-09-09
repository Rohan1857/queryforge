"""Prompt Optimizer — converts raw user input into a structured, schema-aware
query prompt before sending to the SQL generator.

This reduces hallucination by:
1. Matching user terms to actual table/column names (bidirectional fuzzy matching)
2. Clarifying ambiguous requests with matched schema elements
3. Constraining the LLM to only reference existing schema elements
4. Adding column type hints so the LLM picks appropriate aggregations
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
import re

from loguru import logger


def optimize_prompt(
    raw_prompt: str,
    schema_context: str,
    intent: str,
) -> str:
    """Rewrite a raw user prompt into a structured prompt that references
    actual schema elements, reducing the chance of hallucination.

    This is a rule-based optimizer (no LLM call) for speed and reliability.
    """
    # Extract table and column names from the schema context
    tables, columns = _parse_schema_elements(schema_context)

    # Map user terms to actual column names (bidirectional fuzzy matching)
    column_matches = _fuzzy_match_columns(raw_prompt, columns)

    # Map user terms to actual table names
    table_matches = _fuzzy_match_tables(raw_prompt, tables)

    # If no matches found, include ALL tables and columns as context
    if not table_matches and tables:
        table_matches = tables
    if not column_matches and columns:
        column_matches = columns

    # Build the optimized prompt
    parts = [raw_prompt]

    if table_matches:
        parts.append(f"\n\n[MATCHED TABLES: {', '.join(table_matches)}]")

    if column_matches:
        parts.append(f"[MATCHED COLUMNS: {', '.join(column_matches)}]")

    # Add column type annotations when available
    type_hints = _extract_column_types(schema_context, column_matches)
    if type_hints:
        hints_str = ", ".join(f"{col} ({typ})" for col, typ in type_hints.items())
        parts.append(f"[COLUMN TYPES: {hints_str}]")

    date_range_hint = _extract_date_range_hint(raw_prompt)
    if date_range_hint:
        parts.append(f"[DATE RANGE HINT: {date_range_hint}]")

    # Add explicit instructions to reduce hallucination
    parts.append(
        "\n[IMPORTANT: Only use tables and columns listed above. "
        "If the user's requested field doesn't match any column exactly, "
        "use the closest matching column from the MATCHED COLUMNS list. "
        "Never invent table or column names. "
        "If the prompt asks for a month or date range, convert it to concrete "
        "ISO date boundaries for DATE/TIMESTAMP columns instead of using "
        "month-name string comparisons. "
        "All column aliases in SELECT must be valid identifiers.]"
    )

    optimized = "\n".join(parts)
    logger.debug(f"Optimized prompt: {optimized[:300]}...")
    return optimized


def _parse_schema_elements(schema_context: str) -> tuple[list[str], list[str]]:
    """Extract table names and column names from the schema context string."""
    tables: list[str] = []
    columns: list[str] = []

    for line in schema_context.split("\n"):
        line = line.strip()
        # Match "Table: table_name (N rows)"
        table_match = re.match(r"Table:\s+(\S+)", line)
        if table_match:
            tables.append(table_match.group(1))
            continue

        # Match "  - column_name: TYPE" or "column_name: TYPE"
        col_match = re.match(r"-?\s*(\w+):\s+(\w+)", line)
        if col_match and col_match.group(1) not in ("Table", "Connection"):
            columns.append(col_match.group(1))

    return tables, columns


def _extract_column_types(
    schema_context: str, matched_columns: list[str]
) -> dict[str, str]:
    """Extract type info for matched columns from schema context."""
    types: dict[str, str] = {}
    matched_set = {c.lower() for c in matched_columns}

    for line in schema_context.split("\n"):
        line = line.strip()
        col_match = re.match(r"-?\s*(\w+):\s+(\w+)", line)
        if col_match:
            col_name = col_match.group(1)
            col_type = col_match.group(2)
            if col_name.lower() in matched_set:
                types[col_name] = col_type

    return types


# ── Synonym dictionary (bidirectional) ─────────────────────────
_SYNONYMS: dict[str, list[str]] = {
    "revenue": ["sales", "income", "earnings", "turnover", "revenue"],
    "cost": ["expense", "spending", "expenditure", "cost"],
    "profit": ["margin", "earnings", "gain", "net", "profit"],
    "quantity": ["count", "amount", "units", "volume", "qty", "number", "quantity"],
    "date": ["time", "period", "month", "year", "day", "when", "date"],
    "region": ["area", "location", "territory", "zone", "where", "region", "country", "state", "city"],
    "product": ["item", "goods", "sku", "merchandise", "product"],
    "category": ["type", "group", "class", "segment", "category"],
    "name": ["title", "label", "name"],
    "price": ["cost", "rate", "unit_price", "price"],
    "customer": ["client", "buyer", "user", "account", "customer"],
    "order": ["purchase", "transaction", "sale", "order"],
    "status": ["state", "condition", "status"],
    "description": ["desc", "detail", "info", "description"],
}

# Build reverse lookup: synonym_word → canonical_name
_REVERSE_SYNONYMS: dict[str, str] = {}
for _canonical, _syns in _SYNONYMS.items():
    for _syn in _syns:
        _REVERSE_SYNONYMS[_syn] = _canonical


_MONTH_LOOKUP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _fuzzy_match_columns(prompt: str, columns: list[str]) -> list[str]:
    """Find columns that the user likely refers to in their prompt.

    Uses bidirectional matching:
    1. Column name appears in prompt (direct)
    2. Prompt words appear in column name (reverse partial)
    3. Synonym resolution in both directions
    """
    prompt_lower = prompt.lower()
    prompt_words = set(re.findall(r"\w+", prompt_lower))
    matched: list[str] = []
    seen: set[str] = set()

    for col in columns:
        if col in seen:
            continue
        col_lower = col.lower()
        col_parts = set(col_lower.split("_"))

        # 1. Direct: column name appears in prompt
        if col_lower in prompt_lower:
            matched.append(col)
            seen.add(col)
            continue

        # 2. Reverse partial: any prompt word is a substring of column name
        #    e.g. "revenue" in prompt matches "total_revenue" column
        for word in prompt_words:
            if len(word) > 2 and word in col_lower:
                matched.append(col)
                seen.add(col)
                break
        if col in seen:
            continue

        # 3. Column parts appear in prompt words
        #    e.g. column "sales_region" → "sales" in prompt
        for part in col_parts:
            if len(part) > 2 and part in prompt_words:
                matched.append(col)
                seen.add(col)
                break
        if col in seen:
            continue

        # 4. Synonym matching (bidirectional)
        #    e.g. user says "sales" → matches column "revenue"
        for part in col_parts:
            canonical = _REVERSE_SYNONYMS.get(part)
            if canonical:
                # Check if any synonym of this canonical appears in prompt
                for syn in _SYNONYMS.get(canonical, []):
                    if syn in prompt_words:
                        matched.append(col)
                        seen.add(col)
                        break
            if col in seen:
                break

        if col in seen:
            continue

        # 5. Check prompt words against synonyms that map to column parts
        for word in prompt_words:
            canonical = _REVERSE_SYNONYMS.get(word)
            if canonical and canonical in col_parts:
                matched.append(col)
                seen.add(col)
                break

    return matched


def _fuzzy_match_tables(prompt: str, tables: list[str]) -> list[str]:
    """Find tables that the user likely refers to in their prompt."""
    prompt_lower = prompt.lower()
    prompt_words = set(re.findall(r"\w+", prompt_lower))
    matched = []

    for table in tables:
        table_lower = table.lower()

        # Direct: full table name in prompt
        if table_lower in prompt_lower:
            matched.append(table)
            continue

        # Partial: any part of the table name (split by _) in prompt
        table_parts = table_lower.split("_")
        for part in table_parts:
            if len(part) > 2 and part in prompt_words:
                matched.append(table)
                break

    return matched


def _extract_date_range_hint(prompt: str) -> str | None:
    prompt_lower = prompt.lower()

    range_match = re.search(
        r"\b(?:from|between)\s+([a-z]+)\s+(?:to|and)\s+([a-z]+)\s+(\d{4})\b",
        prompt_lower,
    )
    if range_match:
        start_name, end_name, year_text = range_match.groups()
        start_month = _MONTH_LOOKUP.get(start_name)
        end_month = _MONTH_LOOKUP.get(end_name)
        if start_month and end_month:
            year = int(year_text)
            start_date = date(year, start_month, 1)
            inclusive_end = date(year, end_month, monthrange(year, end_month)[1])
            next_month = end_month + 1
            next_year = year
            if next_month == 13:
                next_month = 1
                next_year += 1
            exclusive_end = date(next_year, next_month, 1)
            return (
                "Use ISO dates for the requested range. "
                f"Recommended filter: date_column >= '{start_date.isoformat()}' "
                f"AND date_column < '{exclusive_end.isoformat()}' "
                f"(inclusive end date is '{inclusive_end.isoformat()}')."
            )

    single_month_match = re.search(r"\bin\s+([a-z]+)\s+(\d{4})\b", prompt_lower)
    if single_month_match:
        month_name, year_text = single_month_match.groups()
        month_number = _MONTH_LOOKUP.get(month_name)
        if month_number:
            year = int(year_text)
            start_date = date(year, month_number, 1)
            next_month = month_number + 1
            next_year = year
            if next_month == 13:
                next_month = 1
                next_year += 1
            exclusive_end = date(next_year, next_month, 1)
            return (
                "Use ISO dates for the requested month. "
                f"Recommended filter: date_column >= '{start_date.isoformat()}' "
                f"AND date_column < '{exclusive_end.isoformat()}'."
            )

    return None
