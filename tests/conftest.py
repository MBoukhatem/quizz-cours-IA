from __future__ import annotations

import hashlib
from collections import deque
from typing import Any

import pytest


# ---------------------------------------------------------------------------
# Fake LLM
# ---------------------------------------------------------------------------

class FakeLLM:
    """Stub LLM that returns scripted responses in FIFO order."""

    def __init__(self) -> None:
        self._queue: deque[str] = deque()

    def enqueue(self, response: str) -> None:
        self._queue.append(response)

    def chat(self, messages: list[dict], **kwargs: Any) -> str:
        if self._queue:
            return self._queue.popleft()
        return '{"route": "rag"}'


def make_fake_llm() -> FakeLLM:
    return FakeLLM()


@pytest.fixture
def fake_llm() -> FakeLLM:
    return make_fake_llm()


# ---------------------------------------------------------------------------
# Fake Embedder — deterministic 8-dim hash-based vectors, no model download
# ---------------------------------------------------------------------------

class FakeEmbedder:
    def embed(self, texts: list[str]) -> list[list[float]]:
        result: list[list[float]] = []
        for text in texts:
            h = hashlib.md5(text.encode()).digest()
            vec = [(b / 255.0) * 2 - 1 for b in h[:8]]
            result.append(vec)
        return result


# ---------------------------------------------------------------------------
# tmp_chroma fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_chroma(tmp_path: Any, monkeypatch: Any):
    """VectorStore using local PersistentClient in a temp dir (no HTTP)."""
    import chromadb
    from app.rag.vectorstore import VectorStore

    chroma_path = str(tmp_path / "chroma")

    real_persistent = chromadb.PersistentClient

    def failing_http(*args: Any, **kwargs: Any) -> Any:
        raise ConnectionError("forced fallback")

    def redirected_persistent(path: str = "./.chroma", **kw: Any) -> Any:
        return real_persistent(path=chroma_path, **kw)

    monkeypatch.setattr(chromadb, "HttpClient", failing_http)
    monkeypatch.setattr(chromadb, "PersistentClient", redirected_persistent)

    embedder = FakeEmbedder()
    store = VectorStore(
        host="localhost",
        port=8000,
        collection="test_collection",
        embedder=embedder,  # type: ignore[arg-type]
    )
    assert store.using_fallback is True
    yield store


