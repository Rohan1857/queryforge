"""Validate generated SQL to ensure only safe, schema-aware SELECT queries run."""

from __future__ import annotations

import re
import json
from dataclasses import dataclass, field
from datetime import datetime

import sqlparse
from sqlparse import tokens as sql_tokens
from sqlparse.sql import TokenList

from backend.schemas.connection import SchemaMetadata


class UnsafeQueryError(Exception):
    """Raised when SQL contains dangerous or invalid operations."""


class SQLSemanticError(Exception):
    """Raised when SQL fails schema-aware checks or schema metadata is invalid."""

    def __init__(self, message: str, parsed_sql_ast: str | None = None):
        super().__init__(message)
        self.parsed_sql_ast = parsed_sql_ast


@dataclass
class ValidatedSQL:
    validated_sql: str
    parsed_sql_ast: str


@dataclass
class SQLAnalysis:
    statement_type: str
    tables: list[str] = field(default_factory=list)
    table_aliases: dict[str, str] = field(default_factory=dict)
    qualified_columns: list[tuple[str, str]] = field(default_factory=list)
    unqualified_columns: list[str] = field(default_factory=list)
    select_aliases: list[str] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)
    has_select_star: bool = False
    ast: str = ""


_DANGEROUS_FUNCTIONS = re.compile(
    r"\b(pg_sleep|pg_read_file|lo_import|lo_export|"
    r"pg_ls_dir|pg_stat_file|dblink|COPY|"
    r"xp_cmdshell|sp_executesql|exec\s*\(|"
    r"into\s+(?:outfile|dumpfile))\b",
    re.IGNORECASE,
)

_WRITE_STATEMENTS = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "INTO",
    "EXEC",
    "EXECUTE",
    "MERGE",
    "UPSERT",
    "CALL",
    "REPLACE",
}

_RESERVED_IDENTIFIERS = {
    "ALL",
    "AND",
    "ANY",
    "ASC",
    "AS",
    "BETWEEN",
    "BY",
    "CASE",
    "CAST",
    "CURRENT_DATE",
    "CURRENT_TIMESTAMP",
    "DATE",
    "DATE_TRUNC",
    "DAY",
    "DESC",
    "DISTINCT",
    "ELSE",
    "END",
    "FALSE",
    "FROM",
    "GROUP",
    "HAVING",
    "IN",
    "INTERVAL",
    "IS",
    "JOIN",
    "LEFT",
    "LIKE",
    "LIMIT",
    "MINUTE",
    "MONTH",
    "NOT",
    "NULL",
    "ON",
    "OR",
    "ORDER",
    "OUTER",
    "RIGHT",
    "SECOND",
    "SELECT",
    "THEN",
    "TIMESTAMP",
    "TRUE",
    "WEEK",
    "WHEN",
    "WHERE",
    "WITH",
    "YEAR",
}

_SQL_LITERAL_RE = re.compile(
    r"'(?:[^'\\]|\\.)*'"
    r"|\$\$.*?\$\$",
    re.DOTALL,
)

_SQL_LITERAL_OR_IDENTIFIER_RE = re.compile(
    r"'(?:[^'\\]|\\.)*'"
    r'|"(?:[^"\\]|\\.)*"'
    r"|\$\$.*?\$\$",
    re.DOTALL,
)

_TABLE_REF_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+((?:\"[^\"]+\"|[A-Za-z_][\w$]*)(?:\.(?:\"[^\"]+\"|[A-Za-z_][\w$]*))?)"
    r"(?:\s+(?:AS\s+)?([A-Za-z_][\w$]*))?",
    re.IGNORECASE,
)

_QUALIFIED_COLUMN_RE = re.compile(
    r"((?:\"[^\"]+\"|[A-Za-z_][\w$]*))\s*\.\s*((?:\"[^\"]+\"|[A-Za-z_][\w$]*))(?!\s*\()"
)

_FUNCTION_RE = re.compile(r"\b([A-Za-z_][\w$]*)\s*\(", re.IGNORECASE)
_ALIAS_RE = re.compile(r"\bAS\s+((?:\"[^\"]+\"|[A-Za-z_][\w$]*))", re.IGNORECASE)
_SELECT_STAR_RE = re.compile(r"(^|,)\s*(\*|(?:\"[^\"]+\"|[A-Za-z_][\w$]*)\.\*)\s*(,|FROM|\Z)", re.IGNORECASE)
_DATE_COMPARISON_RE = re.compile(
    r"((?:\"[^\"]+\"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:\"[^\"]+\"|[A-Za-z_][\w$]*))?)"
    r"\s*(?:!=|<>|<=|>=|=|<|>)\s*'([^']+)'",
    re.IGNORECASE,
)
_DATE_BETWEEN_RE = re.compile(
    r"((?:\"[^\"]+\"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:\"[^\"]+\"|[A-Za-z_][\w$]*))?)"
    r"\s+BETWEEN\s+'([^']+)'\s+AND\s+'([^']+)'",
    re.IGNORECASE,
)
_ISO_DATE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$"
)


def _strip_literals(sql: str) -> str:
    return _SQL_LITERAL_RE.sub("''", sql)


def _strip_literals_and_identifiers(sql: str) -> str:
    return _SQL_LITERAL_OR_IDENTIFIER_RE.sub("''", sql)


def _sanitize_identifier(identifier: str) -> str:
    return identifier.strip().strip('"').split(".")[-1].strip('"')


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(value)
    return deduped


def _render_token_tree(token: TokenList, depth: int = 0, lines: list[str] | None = None) -> list[str]:
    lines = lines or []
    raw_value = token.value.replace("\n", " ").strip()
    if raw_value:
        clipped = raw_value[:120]
        lines.append(f"{'  ' * depth}{token.__class__.__name__}: {clipped}")

    if isinstance(token, TokenList):
        for child in token.tokens:
            if child.is_whitespace:
                continue
            if len(lines) >= 120:
                break
            _render_token_tree(child, depth + 1, lines)

    return lines


def analyze_sql(sql: str) -> SQLAnalysis:
    stripped = sql.strip().rstrip(";")
    parsed = sqlparse.parse(stripped)
    if not parsed:
        raise UnsafeQueryError("Could not parse SQL statement")

    statement = parsed[0]
    safe_sql = _strip_literals(stripped)

    tables: list[str] = []
    table_aliases: dict[str, str] = {}
    for table_ref, alias in _TABLE_REF_RE.findall(safe_sql):
        table_name = _sanitize_identifier(table_ref)
        tables.append(table_name)
        if alias:
            table_aliases[_sanitize_identifier(alias).lower()] = table_name.lower()

    qualified_columns = [
        (_sanitize_identifier(table_ref), _sanitize_identifier(column))
        for table_ref, column in _QUALIFIED_COLUMN_RE.findall(safe_sql)
    ]
    functions = _dedupe([_sanitize_identifier(match) for match in _FUNCTION_RE.findall(safe_sql)])
    select_aliases = _dedupe([_sanitize_identifier(match) for match in _ALIAS_RE.findall(safe_sql)])

    known_tables = {table.lower() for table in tables}
    known_aliases = set(table_aliases.keys())
    known_functions = {name.lower() for name in functions}
    known_select_aliases = {alias.lower() for alias in select_aliases}
    qualified_columns_only = {column.lower() for _, column in qualified_columns}

    unqualified_columns: list[str] = []
    for token in statement.flatten():
        if token.is_whitespace or token.ttype in sql_tokens.Literal.String:
            continue
        if token.ttype not in sql_tokens.Name:
            continue

        identifier = _sanitize_identifier(token.value)
        identifier_upper = identifier.upper()
        identifier_lower = identifier.lower()
        if not identifier:
            continue
        if identifier_upper in _RESERVED_IDENTIFIERS:
            continue
        if identifier_lower in known_tables:
            continue
        if identifier_lower in known_aliases:
            continue
        if identifier_lower in known_functions:
            continue
        if identifier_lower in known_select_aliases:
            continue
        if identifier_lower in qualified_columns_only:
            continue

        unqualified_columns.append(identifier)

    return SQLAnalysis(
        statement_type=statement.get_type(),
        tables=_dedupe(tables),
        table_aliases=table_aliases,
        qualified_columns=qualified_columns,
        unqualified_columns=_dedupe(unqualified_columns),
        select_aliases=select_aliases,
        functions=functions,
        has_select_star=bool(_SELECT_STAR_RE.search(safe_sql)),
        ast="\n".join(_render_token_tree(statement)),
    )


def _is_date_like_column(column_type: str, sample_values: list[str]) -> bool:
    normalized_type = column_type.upper()
    if any(marker in normalized_type for marker in ("DATE", "TIME")):
        return True

    if not sample_values:
        return False

    return all(_ISO_DATE_RE.match(str(sample).strip()) for sample in sample_values[:3] if sample)


def _validate_schema_references(sql: str, analysis: SQLAnalysis, schema: SchemaMetadata) -> None:
    table_lookup = {table.name.lower(): table for table in schema.tables}
    columns_by_table = {
        table.name.lower(): {column.name.lower() for column in table.columns}
        for table in schema.tables
    }
    all_columns = {
        column.name.lower()
        for table in schema.tables
        for column in table.columns
    }

    for table_name in analysis.tables:
        if table_name.lower() not in table_lookup:
            raise UnsafeQueryError(f"Unknown table referenced: {table_name}")

    for table_ref, column_name in analysis.qualified_columns:
        resolved_table = analysis.table_aliases.get(table_ref.lower(), table_ref.lower())
        if resolved_table not in columns_by_table:
            raise UnsafeQueryError(f"Unknown table or alias referenced: {table_ref}")
        if column_name.lower() not in columns_by_table[resolved_table]:
            raise UnsafeQueryError(
                f"Unknown column referenced: {table_ref}.{column_name}"
            )

    for column_name in analysis.unqualified_columns:
        if column_name.lower() not in all_columns:
            raise UnsafeQueryError(f"Unknown column referenced: {column_name}")

    date_like_columns = {
        column.name.lower()
        for table in schema.tables
        for column in table.columns
        if _is_date_like_column(column.type, column.sample_values)
    }
    _validate_date_literals(sql, date_like_columns)


def _is_valid_date_literal(value: str) -> bool:
    stripped = value.strip().replace("T", " ")
    if not _ISO_DATE_RE.match(stripped):
        return False

    formats = ["%Y-%m-%d"] if " " not in stripped else ["%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"]
    for fmt in formats:
        try:
            datetime.strptime(stripped, fmt)
            return True
        except ValueError:
            continue
    return False


def _validate_date_literals(sql: str, date_like_columns: set[str]) -> None:
    if not date_like_columns:
        return

    for lhs, rhs in _DATE_COMPARISON_RE.findall(sql):
        column_name = _sanitize_identifier(lhs)
        if column_name.lower() in date_like_columns and not _is_valid_date_literal(rhs):
            raise UnsafeQueryError(
                f"Invalid date literal for column '{column_name}': '{rhs}'. "
                "Use ISO dates like YYYY-MM-DD."
            )

    for lhs, start, end in _DATE_BETWEEN_RE.findall(sql):
        column_name = _sanitize_identifier(lhs)
        if column_name.lower() not in date_like_columns:
            continue
        if not _is_valid_date_literal(start) or not _is_valid_date_literal(end):
            raise UnsafeQueryError(
                f"Invalid BETWEEN date literal for column '{column_name}'. "
                "Use ISO dates like YYYY-MM-DD."
            )


def validate_sql(
    sql: str,
    schema: SchemaMetadata | None = None,
    *,
    return_analysis: bool = False,
) -> bool | SQLAnalysis:
    """Validate that SQL is a safe read-only query.

    Returns True if valid, or the SQLAnalysis when ``return_analysis`` is True.
    """
    stripped = sql.strip().rstrip(";")

    if ";" in stripped:
        raise UnsafeQueryError("Multiple SQL statements are not allowed")

    analysis = analyze_sql(stripped)
    stmt_type = analysis.statement_type.upper() if analysis.statement_type else "UNKNOWN"
    if stmt_type not in ("SELECT", "UNKNOWN"):
        raise UnsafeQueryError(f"Only SELECT queries are allowed, got: {stmt_type}")

    safe_sql = _strip_literals_and_identifiers(stripped).upper()
    for keyword in _WRITE_STATEMENTS:
        if re.search(rf"\b{keyword}\b", safe_sql):
            raise UnsafeQueryError(f"Forbidden keyword detected: {keyword}")

    if _DANGEROUS_FUNCTIONS.search(_strip_literals_and_identifiers(stripped)):
        raise UnsafeQueryError("Dangerous function detected in query")

    if analysis.has_select_star:
        raise UnsafeQueryError("SELECT * queries are not allowed")

    if schema is not None:
        _validate_schema_references(stripped, analysis, schema)

    return analysis if return_analysis else True


def _load_schema(schema_cache: dict | str | None) -> SchemaMetadata | None:
    if not schema_cache:
        return None

    if isinstance(schema_cache, str):
        try:
            schema_cache = json.loads(schema_cache)
        except json.JSONDecodeError as exc:
            raise SQLSemanticError("Schema cache is not valid JSON.") from exc

    try:
        return SchemaMetadata.model_validate(schema_cache)
    except Exception as exc:
        raise SQLSemanticError("Schema cache is invalid or incomplete.") from exc


def validate_sql_with_schema(sql: str, schema_cache: dict | str | None) -> ValidatedSQL:
    """Validate SQL and return normalized SQL + parsed AST for debugging."""
    stripped = sql.strip().rstrip(";")
    analysis = analyze_sql(stripped)

    try:
        schema = _load_schema(schema_cache)
    except SQLSemanticError as exc:
        raise SQLSemanticError(str(exc), parsed_sql_ast=analysis.ast) from exc
    try:
        validate_sql(stripped, schema=schema, return_analysis=False)
    except UnsafeQueryError as exc:
        setattr(exc, "parsed_sql_ast", analysis.ast)
        raise

    return ValidatedSQL(validated_sql=stripped, parsed_sql_ast=analysis.ast)
