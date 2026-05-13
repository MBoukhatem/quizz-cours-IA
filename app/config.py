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

    # Google AI Studio (Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    # Comma-separated allowlist of selectable models (free Flash tier)
    gemini_allowed_models: str = (
        "gemini-2.5-flash-lite,"
        "gemini-2.5-flash,"
        "gemini-2.0-flash-lite,"
        "gemini-2.0-flash,"
        "gemini-flash-lite-latest"
    )

    # ChromaDB
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
