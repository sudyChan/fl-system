from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
from .core.config import settings
from .core.database import engine,Base
from .core.redis import init_redis, close_redis, get_redis
from .core.cache import cache_clear_all
from .core.redis_logger import get_stats as get_cache_stats
from .api.routes import resources, tasks, fraud, chat



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup & shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    await init_redis()
    yield
    await close_redis()
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for the Reinforced Federated Learning Prototype System",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(resources.router, prefix=settings.API_PREFIX, tags=["Resources"])
app.include_router(tasks.router, prefix=settings.API_PREFIX, tags=["Tasks"])
app.include_router(fraud.router, prefix=settings.API_PREFIX, tags=["Fraud Detection"])
app.include_router(chat.router, prefix=settings.API_PREFIX, tags=["Chat"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    redis_status = "disconnected"
    redis_client = get_redis()
    if redis_client:
        try:
            await redis_client.ping()
            redis_status = "connected"
        except Exception:
            redis_status = "error"
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "redis": redis_status,
        "cache_enabled": settings.CACHE_ENABLED,
    }


@app.delete("/api/cache/clear", tags=["Cache"])
async def clear_all_cache():
    """Clear all cached data in Redis."""
    count = await cache_clear_all()
    return {"message": f"Cleared {count} cache keys"}


@app.delete("/api/cache/clear/{prefix}", tags=["Cache"])
async def clear_cache_by_prefix(prefix: str):
    """Clear cached data by key prefix."""
    from .core.cache import cache_delete
    count = await cache_delete(prefix)
    return {"message": f"Cleared {count} cache keys with prefix '{prefix}'"}


@app.get("/api/cache/stats", tags=["Cache"])
async def cache_stats():
    """Get cache hit/miss statistics and current Redis key info."""
    stats = get_cache_stats()
    redis_client = get_redis()
    keys = []
    if redis_client:
        try:
            async for key in redis_client.scan_iter(match="cache:*"):
                ttl = await redis_client.ttl(key)
                keys.append({"key": key, "ttl_seconds": ttl})
        except Exception:
            pass
    return {**stats, "cached_keys": keys}
