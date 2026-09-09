#!/usr/bin/env python3
"""
generate_schema.py — Auto-generate Pydantic model skeletons from a live database.

Connects to the database specified by DATABASE_URL, introspects every table
using SQLAlchemy's inspection API, and prints Pydantic v2 model stubs to
stdout. The output can be redirected into a .py file and refined by hand.

Usage:
    # Use DATABASE_URL from the environment
    python scripts/generate_schema.py

    # Override the connection string
    python scripts/generate_schema.py --database-url postgresql+asyncpg://user:pass@host/db

    # Only generate models for specific tables
    python scripts/generate_schema.py --tables users dashboards

    # Use a synchronous driver (required for introspection)
    python scripts/generate_schema.py --database-url postgresql://user:pass@host/db
"""

from __future__ import annotations

import argparse
import os
import sys
import textwrap
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import create_engine, inspect


# ── SQLAlchemy type -> Python type mapping ──────────────────────────────────
_TYPE_MAP: dict[type[sa.types.TypeEngine], str] = {
    sa.types.String: "str",
    sa.types.Text: "str",
    sa.types.Unicode: "str",
    sa.types.UnicodeText: "str",
    sa.types.Integer: "int",
    sa.types.SmallInteger: "int",
    sa.types.BigInteger: "int",
    sa.types.Float: "float",
    sa.types.Numeric: "Decimal",
    sa.types.Boolean: "bool",
    sa.types.Date: "date",
    sa.types.DateTime: "datetime",
    sa.types.Time: "str",
    sa.types.LargeBinary: "bytes",
    sa.types.JSON: "dict[str, Any]",
    sa.types.ARRAY: "list[Any]",
}

# PostgreSQL-specific UUID type
try:
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    _TYPE_MAP[PG_UUID] = "UUID"
except ImportError:
    pass


def _resolve_python_type(col_type: sa.types.TypeEngine) -> str:
    """Map a SQLAlchemy column type to a Python type annotation string."""
    for sa_type, py_type in _TYPE_MAP.items():
        if isinstance(col_type, sa_type):
            return py_type
    return "Any"


def _to_class_name(table_name: str) -> str:
    """Convert a snake_case table name to a PascalCase class name.

    Strips a trailing 's' for simple English plurals.
    Examples: 'users' -> 'User', 'query_logs' -> 'QueryLog'
    """
    parts = table_name.split("_")
    # Depluralize the last segment (naive but covers common cases)
    if parts[-1].endswith("s") and not parts[-1].endswith("ss"):
        parts[-1] = parts[-1][:-1]
    return "".join(part.capitalize() for part in parts)


def _convert_async_url(url: str) -> str:
    """Convert an async database URL to a synchronous one for introspection.

    SQLAlchemy's inspect() requires a synchronous engine, so we swap out
    known async drivers.
    """
    replacements = {
        "postgresql+asyncpg": "postgresql+psycopg2",
        "sqlite+aiosqlite": "sqlite",
        "mysql+aiomysql": "mysql+pymysql",
    }
    for async_driver, sync_driver in replacements.items():
        if url.startswith(async_driver):
            return url.replace(async_driver, sync_driver, 1)
    return url


def _build_pydantic_imports(columns_info: list[dict[str, Any]]) -> set[str]:
    """Determine which extra imports are needed based on the column types."""
    imports: set[str] = set()
    for col in columns_info:
        py_type = _resolve_python_type(col["type"])
        if py_type == "datetime":
            imports.add("from datetime import datetime")
        elif py_type == "date":
            imports.add("from datetime import date")
        elif py_type == "Decimal":
            imports.add("from decimal import Decimal")
        elif py_type == "UUID":
            imports.add("from uuid import UUID")
        elif "Any" in py_type:
            imports.add("from typing import Any")
    return imports


def generate_model(
    inspector: sa.engine.reflection.Inspector,
    table_name: str,
) -> str:
    """Generate a Pydantic model skeleton for a single database table."""
    columns = inspector.get_columns(table_name)
    pk_columns = inspector.get_pk_constraint(table_name)
    pk_names = set(pk_columns.get("constrained_columns", []))

    class_name = _to_class_name(table_name)

    # Build field lines
    field_lines: list[str] = []
    for col in columns:
        py_type = _resolve_python_type(col["type"])
        nullable = col.get("nullable", True)
        is_pk = col["name"] in pk_names
        has_default = col.get("default") is not None or col.get("autoincrement", False)

        # Decide whether the field is Optional
        if nullable and not is_pk:
            annotation = f"{py_type} | None = None"
        elif has_default and is_pk:
            annotation = f"{py_type} | None = None  # primary key, server-generated"
        else:
            annotation = py_type

        field_lines.append(f"    {col['name']}: {annotation}")

    # Gather imports
    extra_imports = _build_pydantic_imports(columns)

    lines = [
        f"class {class_name}Schema(BaseModel):",
        f'    """Auto-generated schema for table `{table_name}`."""',
        "",
        *field_lines,
        "",
        "    model_config = ConfigDict(from_attributes=True)",
        "",
    ]

    return "\n".join(lines), extra_imports


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auto-generate Pydantic v2 model skeletons from a database.",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help=(
            "SQLAlchemy connection string. Defaults to the DATABASE_URL "
            "environment variable. Async drivers (asyncpg, aiosqlite, "
            "aiomysql) are automatically converted to their synchronous "
            "equivalents for introspection."
        ),
    )
    parser.add_argument(
        "--tables",
        nargs="*",
        default=None,
        help="Only generate schemas for these tables. Defaults to all tables.",
    )
    parser.add_argument(
        "--schema",
        default=None,
        help="Database schema to introspect (default: public / main).",
    )
    args = parser.parse_args()

    # Resolve database URL
    db_url = args.database_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print(
            "ERROR: No database URL provided. Set DATABASE_URL in your "
            "environment or pass --database-url.",
            file=sys.stderr,
        )
        sys.exit(1)

    db_url = _convert_async_url(db_url)

    # Create engine and introspect
    try:
        engine = create_engine(db_url)
        inspector = inspect(engine)
    except Exception as exc:
        print(f"ERROR: Could not connect to the database: {exc}", file=sys.stderr)
        sys.exit(1)

    # Determine which tables to process
    available_tables = inspector.get_table_names(schema=args.schema)
    if not available_tables:
        print("WARNING: No tables found in the database.", file=sys.stderr)
        sys.exit(0)

    if args.tables:
        missing = set(args.tables) - set(available_tables)
        if missing:
            print(
                f"WARNING: Tables not found, skipping: {', '.join(sorted(missing))}",
                file=sys.stderr,
            )
        tables = [t for t in args.tables if t in available_tables]
    else:
        tables = available_tables

    if not tables:
        print("No matching tables to generate schemas for.", file=sys.stderr)
        sys.exit(0)

    # Generate all models and collect imports
    all_imports: set[str] = set()
    model_blocks: list[str] = []

    for table_name in sorted(tables):
        model_code, extra_imports = generate_model(inspector, table_name)
        model_blocks.append(model_code)
        all_imports.update(extra_imports)

    # Print the final output
    header = textwrap.dedent("""\
        # =============================================================================
        # Auto-generated Pydantic schemas
        #
        # Generated by: scripts/generate_schema.py
        # Source DB:     {db_url}
        #
        # Review and refine these models before using in production.
        # =============================================================================

        from pydantic import BaseModel, ConfigDict
    """).format(db_url=_sanitize_url(db_url))

    print(header)

    if all_imports:
        for imp in sorted(all_imports):
            print(imp)
        print()

    print()
    for block in model_blocks:
        print(block)

    engine.dispose()
    print(
        f"# Successfully generated {len(model_blocks)} schema(s) "
        f"from {len(tables)} table(s).",
    )


def _sanitize_url(url: str) -> str:
    """Mask the password in a database URL for safe display."""
    try:
        parsed = sa.engine.url.make_url(url)
        if parsed.password:
            return str(parsed.set(password="****"))
        return str(parsed)
    except Exception:
        return "<redacted>"


if __name__ == "__main__":
    main()
