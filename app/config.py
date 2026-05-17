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

    # Ollama (local LLM)
    ollama_model: str = "qwen2.5:0.5b"
    ollama_base_url: str = "http://ollama:11434"
    # Comma-separated allowlist of selectable local models.
    # Ordered from lightest to heaviest — keep qwen2.5:0.5b first so the
    # default works on memory-constrained machines (< 2 GB free).
    ollama_allowed_models: str = (
        "qwen2.5:0.5b,"
        "gemma2:2b,"
        "llama3.2:3b,"
        "qwen2.5:7b"
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
