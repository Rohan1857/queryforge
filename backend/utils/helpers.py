"""Misc utility functions."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def safe_uuid(value: str) -> uuid.UUID | None:
    """Parse a string as UUID, returning None on failure."""
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None


def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text to max_len characters with ellipsis."""
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def format_number(value: float | int) -> str:
    """Format a number with appropriate suffixes for display."""
    if abs(value) >= 1_000_000_000:
        return f"{value / 1_000_000_000:.1f}B"
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if abs(value) >= 1_000:
        return f"{value / 1_000:.1f}K"
    if isinstance(value, float):
        return f"{value:,.2f}"
    return f"{value:,}"


def to_json_compatible(value: Any) -> Any:
    """Convert nested values into JSON-safe primitives for JSONB storage."""
    return json.loads(json.dumps(value, default=str))
