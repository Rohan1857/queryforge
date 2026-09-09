from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from backend.config import settings


def _key_func(request: Request) -> str:
    """Extract user ID from JWT if present, otherwise fall back to IP."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            from backend.services.auth_service import decode_token

            payload = decode_token(auth.split(" ", 1)[1])
            return f"user:{payload['sub']}"
        except Exception:
            pass
    return get_remote_address(request)


import os

storage_uri = "memory://" if os.getenv("TESTING") == "1" or settings.REDIS_URL == "memory://" else settings.REDIS_URL

limiter = Limiter(
    key_func=_key_func,
    storage_uri=storage_uri,
    default_limits=["200/minute"],
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)
