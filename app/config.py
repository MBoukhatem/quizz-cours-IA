from __future__ import annotations

import functools

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_fallback_model: str = "google/gemini-2.0-flash-exp:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    chroma_collection: str = "courses"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    app_log_level: str = "INFO"
    quiz_default_questions: int = 5
    max_history_turns: int = 5


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
