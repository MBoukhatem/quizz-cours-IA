"""ChromaDB wrapper: indexing and semantic search of course chunks.

We use chromadb's HttpClient to talk to the chromadb service container, and a
local sentence-transformers embedding function so embeddings are computed
inside the backend (no external API needed).
"""
from __future__ import annotations

import logging
import threading
from typing import Any, Optional

import chromadb
from chromadb.utils import embedding_functions

from config import get_settings
from services.document_processor import Chunk, iter_chunks_for_chroma

logger = logging.getLogger("tuteur_quiz.vectorstore")


class VectorStore:
    def __init__(self) -> None:
        s = get_settings()
        self._embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=s.embedding_model
        )
        self._client = chromadb.HttpClient(host=s.chroma_host, port=s.chroma_port)
        self._collection_name = s.chroma_collection
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            embedding_function=self._embedder,
            metadata={"hnsw:space": "cosine"},
        )

    # ----- Indexing -----

    def index_chunks(self, document_id: str, chunks: list[Chunk]) -> int:
        if not chunks:
            return 0
        ids, docs, metas = iter_chunks_for_chroma(chunks)
        ids = [f"{document_id}::{i}" for i in ids]
        for m in metas:
            m["document_id"] = document_id
        self._collection.upsert(ids=ids, documents=docs, metadatas=metas)
        return len(ids)

    # ----- Retrieval -----

    def query(
        self,
        text: str,
        top_k: Optional[int] = None,
        exclude_chunk_ids: Optional[list[str]] = None,
        document_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        top_k = top_k or get_settings().top_k_chunks
        where: Optional[dict[str, Any]] = {"document_id": document_id} if document_id else None
        results = self._collection.query(
            query_texts=[text],
            n_results=max(top_k * 2, top_k + 3),
            where=where,
        )
        out: list[dict[str, Any]] = []
        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0] if results.get("distances") else [None] * len(ids)
        excluded = set(exclude_chunk_ids or [])
        for i, chunk_id in enumerate(ids):
            if chunk_id in excluded:
                continue
            out.append(
                {
                    "chunk_id": chunk_id,
                    "text": documents[i],
                    "metadata": metadatas[i] or {},
                    "distance": distances[i],
                }
            )
            if len(out) >= top_k:
                break
        return out

    def random_chunks(self, n: int = 5, document_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Approximate random sampling: get many ids, return a slice."""
        where = {"document_id": document_id} if document_id else None
        try:
            data = self._collection.get(where=where, limit=max(100, n * 10))
        except Exception:
            return []
        ids = data.get("ids", []) or []
        docs = data.get("documents", []) or []
        metas = data.get("metadatas", []) or []
        if not ids:
            return []
        import random

        indices = list(range(len(ids)))
        random.shuffle(indices)
        out = []
        for i in indices[:n]:
            out.append({"chunk_id": ids[i], "text": docs[i], "metadata": metas[i] or {}})
        return out

    # ----- Maintenance -----

    def delete_document(self, document_id: str) -> int:
        try:
            existing = self._collection.get(where={"document_id": document_id})
            ids = existing.get("ids", []) or []
        except Exception:
            ids = []
        if not ids:
            return 0
        self._collection.delete(ids=ids)
        return len(ids)

    def total_chunks(self) -> int:
        try:
            return self._collection.count()
        except Exception:
            return 0

    def ping(self) -> bool:
        try:
            self._client.heartbeat()
            return True
        except Exception as exc:
            logger.warning("Chroma heartbeat failed: %s", exc)
            return False


_store: Optional[VectorStore] = None
_lock = threading.Lock()


def get_vectorstore() -> VectorStore:
    global _store
    if _store is None:
        with _lock:
            if _store is None:
                _store = VectorStore()
    return _store
