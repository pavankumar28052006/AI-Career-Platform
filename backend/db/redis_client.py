"""Async Redis singleton using aioredis."""

import json
from typing import Any, Optional

import redis.asyncio as aioredis

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)
_redis: Optional[aioredis.Redis] = None


async def init_redis() -> None:
    """Initialise the Redis connection pool. Called once at app startup."""
    global _redis
    settings = get_settings()
    _redis = await aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    await _redis.ping()
    logger.info("Redis connected", extra={"url": settings.redis_url})


async def close_redis() -> None:
    """Close the Redis connection. Called once at app shutdown."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis:
    """Return the shared Redis client. Raises if not yet initialised."""
    if _redis is None:
        raise RuntimeError("Redis client is not initialised. Call init_redis() first.")
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    """Return the deserialised value for *key*, or None on cache miss."""
    redis = get_redis()
    raw = await redis.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Serialise *value* to JSON and store under *key* with *ttl* seconds."""
    redis = get_redis()
    await redis.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    """Delete *key* from the cache."""
    redis = get_redis()
    await redis.delete(key)
