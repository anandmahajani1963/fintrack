# ============================================================
# fintrack — Application configuration
# File: /home/fintrack/fintrack/backend/app/config.py
# All values loaded from .env via pydantic-settings
# ============================================================

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DB_HOST:     str = "192.168.1.169"
    DB_PORT:     int = 5432
    DB_NAME:     str = "fintrack"
    DB_USER:     str = "fintrack"
    DB_PASSWORD: str

    # API
    API_HOST:    str = "0.0.0.0"
    API_PORT:    int = 8000
    API_ENV:     str = "development"
    SECRET_KEY:  str

    # Token expiry
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS:   int = 30

    # Key derivation (Argon2id)
    KDF_ALGORITHM:   str = "argon2id"
    KDF_TIME_COST:   int = 2
    KDF_MEMORY_COST: int = 65536
    KDF_PARALLELISM: int = 2
    KDF_HASH_LENGTH: int = 32

    # CORS
    CORS_ORIGINS: str = '["http://192.168.1.171:3000","http://localhost:3000","https://fintrack.local","https://fintrack.local:32606"]'

    # AI (Phase 4 — optional for now)
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL:          str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS:     int = 1000

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE:  str = "/var/log/fintrack/api.log"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


    # SMTP settings for email OTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Single shared instance used across the app
settings = get_settings()

