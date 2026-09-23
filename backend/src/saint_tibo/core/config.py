from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_prefix="BACKEND_", extra="ignore")

    # No default: a missing BACKEND_DATABASE_URL must fail loudly instead of
    # silently connecting to another database.
    database_url: PostgresDsn
    cors_origins: list[str] = ["http://localhost:3000"]
    auth_jwks_url: str = "http://localhost:3000/api/auth/jwks"
    auth_issuer: str = "http://localhost:3000"
    auth_audience: str = "saint_tibo-api"
    jwks_cache_seconds: int = Field(default=300, ge=1)
    jwks_refresh_cooldown_seconds: int = Field(default=5, ge=1)
    http_timeout_seconds: float = Field(default=5, gt=0)
    database_timeout_seconds: float = Field(default=5, gt=0)
    log_level: str = "INFO"
