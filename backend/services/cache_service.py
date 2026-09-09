"""Redis caching layer for schema, suggestions, and query results."""

from __future__ import annotations

import json
from typing import Any

from loguru import logger


class CacheService:
    """Thin wrapper around Redis for BI-specific caching patterns."""

    def __init__(self, redis_client) -> None:
        self._redis = redis_client

    @property
    def available(self) -> bool:
        return self._redis is not None

    async def get_schema(self, connection_id: str) -> dict | None:
        if not self.available:
            return None
        try:
            raw = await self._redis.get(f"schema:{connection_id}")
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.warning(f"Cache get_schema failed: {e}")
            return None

    async def set_schema(self, connection_id: str, schema: dict, ttl: int = 300) -> None:
        if not self.available:
            return
        try:
            await self._redis.setex(f"schema:{connection_id}", ttl, json.dumps(schema))
        except Exception as e:
            logger.warning(f"Cache set_schema failed: {e}")

    async def get_suggestions(self, connection_id: str) -> list[str] | None:
        if not self.available:
            return None
        try:
            raw = await self._redis.get(f"suggestions:{connection_id}")
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.warning(f"Cache get_suggestions failed: {e}")
            return None

    async def set_suggestions(
        self, connection_id: str, suggestions: list[str], ttl: int = 600
    ) -> None:
        if not self.available:
            return
        try:
            await self._redis.setex(
                f"suggestions:{connection_id}", ttl, json.dumps(suggestions)
            )
        except Exception as e:
            logger.warning(f"Cache set_suggestions failed: {e}")

    async def get_query_result(self, cache_key: str) -> dict | None:
        if not self.available:
            return None
        try:
            raw = await self._redis.get(f"query:{cache_key}")
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.warning(f"Cache get_query_result failed: {e}")
            return None

    async def set_query_result(
        self, cache_key: str, result: dict, ttl: int = 120
    ) -> None:
        if not self.available:
            return
        try:
            await self._redis.setex(f"query:{cache_key}", ttl, json.dumps(result))
        except Exception as e:
            logger.warning(f"Cache set_query_result failed: {e}")

    async def invalidate(self, pattern: str) -> None:
        if not self.available:
            return
        try:
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                await self._redis.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache invalidate failed: {e}")
