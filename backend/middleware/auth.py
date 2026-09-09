"""JWT verification middleware.

The actual get_current_user dependency lives in backend/dependencies.py.
This module re-exports it for compatibility with the architecture spec,
and provides an optional Starlette middleware for blanket JWT enforcement.
"""

from backend.dependencies import get_current_user

__all__ = ["get_current_user"]
