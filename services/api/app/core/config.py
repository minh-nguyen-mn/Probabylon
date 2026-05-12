import os
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_ENV_FILE = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(str(ROOT_ENV_FILE), ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Probabylon API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    database_url: str = Field(default="postgresql+psycopg://postgres:postgres@db:5432/probabylon")
    redis_url: str = Field(default="redis://redis:6379/0")
    broker_url: str = Field(default="redis://redis:6379/1")
    result_backend: str = Field(default="redis://redis:6379/2")

    default_llm_provider: str = ""
    default_llm_model: str = ""
    openrouter_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = Field(default="", validation_alias=AliasChoices("OPENAI_BASE_URL", "BASE_URL"))
    anthropic_api_key: str = ""
    groq_api_key: str = ""

    otel_exporter_otlp_endpoint: str = ""

    # Auth / JWT
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
settings = Settings()


def _clean_secret(value: str) -> str:
    cleaned = (value or "").strip().strip("\"'")
    if cleaned.endswith("...") or cleaned.lower() in {"none", "null"}:
        return ""
    return cleaned


def _infer_provider(current: str) -> str:
    provider = (current or "").strip().lower()
    available = {
        "openai": bool(settings.openai_api_key),
        "anthropic": bool(settings.anthropic_api_key),
        "openrouter": bool(settings.openrouter_api_key),
        "groq": bool(settings.groq_api_key),
    }
    if provider and available.get(provider):
        return provider
    for candidate in ("openai", "anthropic", "openrouter", "groq"):
        if available[candidate]:
            return candidate
    return provider or "openrouter"


settings.openai_api_key = _clean_secret(settings.openai_api_key)
settings.anthropic_api_key = _clean_secret(settings.anthropic_api_key)
settings.openrouter_api_key = _clean_secret(settings.openrouter_api_key)
settings.groq_api_key = _clean_secret(settings.groq_api_key)
settings.openai_base_url = _clean_secret(settings.openai_base_url)
settings.default_llm_provider = _infer_provider(settings.default_llm_provider)

model_override = _clean_secret(os.getenv("MODEL_CHAT", "")) or _clean_secret(os.getenv("OPENAI_MODEL", ""))
settings.default_llm_model = model_override or _clean_secret(settings.default_llm_model)

if settings.default_llm_model.endswith(":free"):
    settings.default_llm_model = settings.default_llm_model.removesuffix(":free")

if not settings.default_llm_model:
    provider_defaults = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-sonnet-4-20250514",
        "openrouter": "deepseek/deepseek-chat-v3-0324",
        "groq": "deepseek-r1-distill-llama-70b",
    }
    settings.default_llm_model = provider_defaults[settings.default_llm_provider]
elif settings.default_llm_provider == "openai" and "/" in settings.default_llm_model:
    settings.default_llm_model = "gpt-4o-mini"
elif settings.default_llm_provider == "openrouter" and settings.default_llm_model not in {
    "deepseek/deepseek-chat-v3-0324",
    "deepseek/deepseek-r1",
} and settings.default_llm_model.startswith("deepseek/"):
    settings.default_llm_model = "deepseek/deepseek-chat-v3-0324"
