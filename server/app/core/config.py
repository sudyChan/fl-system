from pydantic_settings import BaseSettings

from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "FL System Backend"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 10825

    # Database
    DATABASE_URL: str = "postgresql://cn_admin:slwl@10.129.209.249:5433/computing_network?sslmode=prefer"
    DATABASE_URL_FALLBACK: str = "sqlite:///./fl_system.db"
    DB_HOST: str = "10.129.209.249"
    DB_PORT: int = 5433
    DB_NAME: str = "computing_network"
    DB_USER: str = "cn_admin"
    DB_PASSWORD: str = "slwl"
    DB_ADMIN_USER: str = "postgres"
    DB_ADMIN_PASSWORD: str = "root"

    # Redis (optional, for caching & Celery)
    REDIS_URL: Optional[str] = "redis://localhost:6379/0"

    # Cache
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 60

    # JWT Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # LLM / Chat API (for the AI assistant feature)
    LLM_API_URL: Optional[str] = None
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-3.5-turbo"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:8019", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
