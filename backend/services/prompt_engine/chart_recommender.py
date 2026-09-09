"""Recommend the best chart type based on actual query result data shape."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from loguru import logger


def _detect_column_types(data: list[dict]) -> dict[str, str]:
    """Detect column types from actual data values."""
    if not data:
        return {}

    types: dict[str, str] = {}
    for col in data[0]:
        # Sample first 10 non-null values
        values = [row[col] for row in data[:10] if row.get(col) is not None]
        if not values:
            types[col] = "unknown"
            continue

        sample = values[0]
        if isinstance(sample, (int, float)):
            types[col] = "numeric"
        elif isinstance(sample, (datetime, date)):
            types[col] = "datetime"
        elif isinstance(sample, str):
            # Check if it looks like a date string
            if any(c in sample for c in ["-", "/", ":"]) and len(sample) >= 8:
                try:
                    datetime.fromisoformat(sample.replace("Z", "+00:00"))
                    types[col] = "datetime"
                    continue
                except (ValueError, TypeError):
                    pass
            types[col] = "categorical"
        else:
            types[col] = "categorical"

    return types


def recommend(data: list[dict], column_types: dict | None = None, intent: str = "") -> str:
    """Analyze query results and return the best chart type.

    Returns one of: bar, line, pie, scatter, kpi, table
    """
    if not data:
        return "table"

    if column_types is None:
        column_types = _detect_column_types(data)

    num_rows = len(data)
    num_cols = len(data[0]) if data else 0

    numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
    datetime_cols = [c for c, t in column_types.items() if t == "datetime"]
    categorical_cols = [c for c, t in column_types.items() if t == "categorical"]

    # Rule 1: Single row with numeric value → KPI
    if num_rows == 1 and numeric_cols:
        logger.debug("Chart recommendation: kpi (single numeric row)")
        return "kpi"

    # Rule 2: Datetime + numeric → line chart
    if datetime_cols and numeric_cols:
        logger.debug("Chart recommendation: line (time series)")
        return "line"

    # Rule 3: 1 categorical + 1 numeric, few categories → bar
    if len(categorical_cols) >= 1 and len(numeric_cols) >= 1 and num_rows < 15:
        # Check if values sum to ~100% (pie chart candidate)
        if len(numeric_cols) == 1:
            total = sum(row.get(numeric_cols[0], 0) or 0 for row in data)
            if 95 <= total <= 105:
                logger.debug("Chart recommendation: pie (sums to ~100%)")
                return "pie"
        logger.debug("Chart recommendation: bar (categorical + numeric, <15 categories)")
        return "bar"

    # Rule 4: 1 categorical + 1 numeric, many categories → table
    if len(categorical_cols) >= 1 and len(numeric_cols) >= 1 and num_rows >= 15:
        logger.debug("Chart recommendation: table (categorical + numeric, >=15 rows)")
        return "table"

    # Rule 5: 2 numeric columns → scatter
    if len(numeric_cols) >= 2 and not categorical_cols and not datetime_cols:
        logger.debug("Chart recommendation: scatter (2+ numeric)")
        return "scatter"

    # Rule 6: Many columns or many rows → table
    if num_cols > 5 or num_rows > 50:
        logger.debug("Chart recommendation: table (many cols/rows)")
        return "table"

    # Default
    logger.debug("Chart recommendation: bar (default)")
    return "bar"
