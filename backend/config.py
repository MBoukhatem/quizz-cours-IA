"""Centralised configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "mistral:7b"
    ollama_timeout: int = 120

    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    chroma_collection: str = "tuteur_quiz_corpus"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    log_level: str = "INFO"
    log_dir: str = "/data/logs"

    embedding_model: str = "all-MiniLM-L6-v2"

    chunk_size: int = 500
    chunk_overlap: int = 50
    min_chunk_size: int = 100

    default_difficulty: str = "facile"
    questions_for_adaptation: int = 5
    top_k_chunks: int = 5

    database_path: str = "/data/db/sessions.db"
    upload_dir: str = "/data/uploads"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
