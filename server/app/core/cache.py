import json
import functools
import time
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any

from app.core.redis import get_redis
from app.core.redis_logger import log_hit, log_miss, log_set, log_delete, log_clear, log_error


def _default_encoder(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _serialize(data: Any) -> str:
    return json.dumps(data, default=_default_encoder, ensure_ascii=False)


def _deserialize(raw: str) -> Any:
    return json.loads(raw)


async def cache_get(key: str) -> Optional[Any]:
    redis = get_redis()
    if not redis:
        return None
    t0 = time.monotonic()
    try:
        raw = await redis.get(key)
        cost = (time.monotonic() - t0) * 1000
        if raw is not None:
            log_hit(key, cost)
            return _deserialize(raw)
        log_miss(key, cost)
        return None
    except Exception as e:
        log_error("GET", key, e)
        return None


async def cache_set(key: str, data: Any, ttl: int = 60) -> bool:
    redis = get_redis()
    if not redis:
        return False
    t0 = time.monotonic()
    try:
        payload = _serialize(data)
        await redis.set(key, payload, ex=ttl)
        cost = (time.monotonic() - t0) * 1000
        log_set(key, ttl, len(payload.encode("utf-8")), cost)
        return True
    except Exception as e:
        log_error("SET", key, e)
        return False


async def cache_delete(prefix: str) -> int:
    redis = get_redis()
    if not redis:
        return 0
    t0 = time.monotonic()
    try:
        keys = []
        async for key in redis.scan_iter(match=f"cache:{prefix}:*"):
            keys.append(key)
        if keys:
            deleted = await redis.delete(*keys)
            cost = (time.monotonic() - t0) * 1000
            log_delete(keys, cost)
            return deleted
        return 0
    except Exception as e:
        log_error("DELETE", f"prefix={prefix}", e)
        return 0


async def cache_clear_all() -> int:
    redis = get_redis()
    if not redis:
        return 0
    t0 = time.monotonic()
    try:
        keys = []
        async for key in redis.scan_iter(match="cache:*"):
            keys.append(key)
        if keys:
            deleted = await redis.delete(*keys)
            cost = (time.monotonic() - t0) * 1000
            log_clear(deleted, cost)
            return deleted
        return 0
    except Exception as e:
        log_error("CLEAR", "ALL", e)
        return 0


def cached(ttl: int = 60, key_prefix: str = "api"):
    """
    Cache decorator for FastAPI route functions.

    Usage:
        @router.get("/resources/map")
        @cached(ttl=300, key_prefix="resources")
        async def get_map_nodes():
            ...

    Flow:
        1. Build cache key: cache:{key_prefix}:{function_name}
        2. Check Redis for existing data
        3. Cache hit  -> return deserialized data
        4. Cache miss -> execute original function -> store result -> return
        5. Redis unavailable -> execute original function directly (graceful degradation)
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            from app.core.config import settings

            if not getattr(settings, "CACHE_ENABLED", True):
                return await func(*args, **kwargs)

            cache_key = f"cache:{key_prefix}:{func.__name__}"

            hit = await cache_get(cache_key)
            if hit is not None:
                return hit

            result = await func(*args, **kwargs)

            await cache_set(cache_key, result, ttl=ttl)

            return result

        return wrapper

    return decorator
