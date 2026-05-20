import os
import time
import asyncio
from loguru import logger

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

_cache_logger = logger.bind(name="redis")

_cache_logger.add(
    os.path.join(LOG_DIR, "redis_cache.log"),
    rotation="10 MB",
    retention="30 days",
    compression="zip",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<7} | {message}",
    enqueue=True,
    backtrace=True,
    diagnose=False,
)

_hit_count = 0
_miss_count = 0
_set_count = 0
_delete_count = 0
_error_count = 0


def log_hit(key: str, cost_ms: float):
    global _hit_count
    _hit_count += 1
    _cache_logger.info(f"HIT   | key={key} | cost={cost_ms:.2f}ms | total_hits={_hit_count}")


def log_miss(key: str, cost_ms: float):
    global _miss_count
    _miss_count += 1
    _cache_logger.info(f"MISS  | key={key} | cost={cost_ms:.2f}ms | total_misses={_miss_count}")


def log_set(key: str, ttl: int, data_size: int, cost_ms: float):
    global _set_count
    _set_count += 1
    _cache_logger.info(f"SET   | key={key} | ttl={ttl}s | size={data_size} bytes | cost={cost_ms:.2f}ms | total_sets={_set_count}")


def log_delete(keys: list[str], cost_ms: float):
    global _delete_count
    _delete_count += len(keys)
    _cache_logger.info(f"DEL   | keys={keys} | cost={cost_ms:.2f}ms | total_deletes={_delete_count}")


def log_clear(count: int, cost_ms: float):
    global _delete_count
    _delete_count += count
    _cache_logger.info(f"CLEAR | count={count} | cost={cost_ms:.2f}ms | total_deletes={_delete_count}")


def log_error(action: str, key: str, error: Exception):
    global _error_count
    _error_count += 1
    _cache_logger.error(f"ERROR | action={action} | key={key} | error={error.__class__.__name__}: {error} | total_errors={_error_count}")


def log_connect(url: str):
    _cache_logger.info(f"CONNECT | url={url}")


def log_disconnect():
    _cache_logger.info("DISCONNECT | pool closed")


def log_connect_failed(error: Exception):
    _cache_logger.error(f"CONNECT_FAILED | error={error.__class__.__name__}: {error}")


def get_stats() -> dict:
    total = _hit_count + _miss_count
    hit_rate = round(_hit_count / total * 100, 2) if total > 0 else 0.0
    return {
        "hit_count": _hit_count,
        "miss_count": _miss_count,
        "set_count": _set_count,
        "delete_count": _delete_count,
        "error_count": _error_count,
        "hit_rate": f"{hit_rate}%",
        "total_requests": total,
    }
