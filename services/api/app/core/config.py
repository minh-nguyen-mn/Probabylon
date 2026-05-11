from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Probabylon API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    database_url: str = Field(default="postgresql+psycopg://postgres:postgres@db:5432/probabylon")
    redis_url: str = Field(default="redis://redis:6379/0")
    broker_url: str = Field(default="redis://redis:6379/1")
    result_backend: str = Field(default="redis://redis:6379/2")

    default_llm_provider: str = "openrouter"
    default_llm_model: str = "deepseek/deepseek-chat-v3-0324:free"
    openrouter_api_key: str = ""
    openai_api_key: str = ""
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
