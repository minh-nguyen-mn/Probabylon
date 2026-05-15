from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / ".env"
        if candidate.exists():
            return str(candidate)
    return ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_find_env_file(), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Probabylon API"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    database_url: str = Field(alias="DATABASE_URL")
    database_url_unpooled: str = Field(alias="DATABASE_URL_UNPOOLED")
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    broker_url: str = Field(default="redis://redis:6379/1", alias="BROKER_URL")
    result_backend: str = Field(default="redis://redis:6379/2", alias="RESULT_BACKEND")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_refresh_secret: str = Field(alias="JWT_REFRESH_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 14
    google_oauth_state_ttl_minutes: int = 10

    google_client_id: str = Field(alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(alias="GOOGLE_CLIENT_SECRET")

    frontend_url: AnyHttpUrl = Field(alias="FRONTEND_URL")
    backend_url: AnyHttpUrl = Field(alias="BACKEND_URL")
    cors_origins: str = Field(alias="CORS_ORIGINS")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="", alias="OPENAI_BASE_URL")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    default_llm_provider: str = Field(default="openai", alias="DEFAULT_LLM_PROVIDER")
    default_llm_model: str = Field(default="gpt-4.1-mini", alias="DEFAULT_LLM_MODEL")

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        required_non_empty = {
            "DATABASE_URL": self.database_url,
            "DATABASE_URL_UNPOOLED": self.database_url_unpooled,
            "JWT_SECRET": self.jwt_secret,
            "JWT_REFRESH_SECRET": self.jwt_refresh_secret,
            "GOOGLE_CLIENT_ID": self.google_client_id,
            "GOOGLE_CLIENT_SECRET": self.google_client_secret,
            "FRONTEND_URL": str(self.frontend_url),
            "BACKEND_URL": str(self.backend_url),
            "CORS_ORIGINS": self.cors_origins,
        }
        missing = [name for name, value in required_non_empty.items() if not str(value or "").strip()]
        if missing:
            joined = ", ".join(sorted(missing))
            raise ValueError(f"Missing required environment variables: {joined}")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cookie_secure(self) -> bool:
        return self.is_production

    @property
    def cookie_samesite(self) -> str:
        return "none" if self.is_production else "lax"

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        frontend_origin = str(self.frontend_url).rstrip("/")
        backend_origin = str(self.backend_url).rstrip("/")
        merged: list[str] = []
        for origin in [frontend_origin, backend_origin, *origins]:
            if origin not in merged:
                merged.append(origin)
        return merged

    @property
    def google_redirect_uri(self) -> str:
        return f"{str(self.backend_url).rstrip('/')}/api/auth/google/callback"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
