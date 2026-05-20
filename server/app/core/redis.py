import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings
from app.core.redis_logger import log_connect, log_disconnect, log_connect_failed

_redis_pool: aioredis.Redis | None = None


async def init_redis() -> aioredis.Redis | None:
    global _redis_pool
    if not settings.REDIS_URL:
        logger.warning("[Redis] REDIS_URL not configured, caching disabled")
        return None
    try:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        await _redis_pool.ping()
        log_connect(settings.REDIS_URL)
        logger.info(f"[Redis] Connected: {settings.REDIS_URL}")
        return _redis_pool
    except Exception as e:
        log_connect_failed(e)
        logger.warning(f"[Redis] Connection failed: {e.__class__.__name__}: {e}")
        _redis_pool = None
        return None


async def close_redis():
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
        log_disconnect()
        logger.info("[Redis] Connection pool closed")


def get_redis() -> aioredis.Redis | None:
    return _redis_pool
