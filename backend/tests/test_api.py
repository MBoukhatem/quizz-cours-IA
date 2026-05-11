"""Integration tests for the FastAPI endpoints, with LLM + ChromaDB mocked.

These tests exercise routing, request/response shape and SQLite persistence
without requiring Ollama or ChromaDB to be running.
"""
from __future__ import annotations

import os
import sys
from typing import Any

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Point persistent paths to tmp before importing the app.
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "sessions.db"))
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "logs"))
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:0")
    monkeypatch.setenv("CHROMA_HOST", "localhost")
    monkeypatch.setenv("CHROMA_PORT", "0")

    # Clear cached settings.
    from config import get_settings

    get_settings.cache_clear()

    # Stub the vectorstore (avoid ChromaDB HTTP).
    class _StubStore:
        def index_chunks(self, document_id, chunks):
            return len(chunks)

        def query(self, text, top_k=None, exclude_chunk_ids=None, document_id=None):
            return [
                {
                    "chunk_id": "cours.md::chunk_0",
                    "text": "Le tri par insertion a une complexité O(n^2).",
                    "metadata": {"source": "cours.md", "page": 1, "document_id": "doc_x"},
                    "distance": 0.1,
                }
            ]

        def random_chunks(self, n=5, document_id=None):
            return []

        def delete_document(self, document_id):
            return 0

        def total_chunks(self):
            return 1

        def ping(self):
            return True

    import services.vectorstore as vs_mod

    vs_mod._store = _StubStore()

    # Stub the LLM client.
    class _StubLLM:
        model = "mistral:7b"

        async def generate(self, prompt: str, system=None, **_: Any) -> str:
            if "Explique en français" in prompt or "Explique en franc" in prompt:
                return "Explication: le tri par insertion est O(n^2)."
            return (
                '{"question":"Quelle est la complexité du tri par insertion ?",'
                '"choices":["O(1)","O(log n)","O(n^2)","O(2^n)"],'
                '"correct_index":2,"rationale":"O(n^2) est dans le texte."}'
            )

        async def ping(self):
            return True

        async def model_available(self):
            return True

    import services.llm_client as llm_mod

    llm_mod._client = _StubLLM()

    # Now import the app (after env + stubs).
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if "main" in sys.modules:
        del sys.modules["main"]
    from main import app

    with TestClient(app) as c:
        yield c


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Tuteur" in r.json()["name"]


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"ok", "degraded", "down"}
    assert any(c["name"] == "ollama" for c in body["components"])
    assert any(c["name"] == "chromadb" for c in body["components"])


def test_full_quiz_flow(client):
    # Generate
    payload = {"session_id": "test_session"}
    r = client.post("/api/quiz/generate", json=payload)
    assert r.status_code == 200, r.text
    q = r.json()
    assert len(q["choices"]) == 4
    assert 0 <= q["correct_index"] <= 3
    qid = q["question_id"]

    # Answer (correct)
    r = client.post(
        "/api/quiz/answer",
        json={"question_id": qid, "session_id": "test_session", "selected_index": q["correct_index"]},
    )
    assert r.status_code == 200, r.text
    fb = r.json()
    assert fb["is_correct"] is True
    assert fb["score_session"] == 1
    assert fb["total_session"] == 1

    # Session state
    r = client.get("/api/quiz/session/test_session")
    assert r.status_code == 200
    assert r.json()["correct_answers"] == 1


def test_stats_summary(client):
    r = client.get("/api/stats/summary")
    assert r.status_code == 200
    body = r.json()
    for key in ("total_questions", "correct_answers", "success_rate", "documents_indexed"):
        assert key in body
