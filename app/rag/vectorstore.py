from __future__ import annotations

import logging

from app.rag.embeddings import Embedder

logger = logging.getLogger(__name__)


class VectorStore:
    """ChromaDB-backed vector store with local PersistentClient fallback."""

    def __init__(
        self,
        host: str,
        port: int,
        collection: str,
        embedder: Embedder,
    ) -> None:
        import chromadb

        self._collection_name = collection
        self._embedder = embedder
        self.using_fallback: bool = False

        try:
            self._client = chromadb.HttpClient(host=host, port=port)
            # probe the connection eagerly
            self._client.heartbeat()
            logger.info("Connected to ChromaDB at %s:%d", host, port)
        except Exception as exc:
            logger.warning(
                "ChromaDB HTTP unreachable (%s). Falling back to PersistentClient at ./.chroma",
                exc,
            )
            self._client = chromadb.PersistentClient(path="./.chroma")
            self.using_fallback = True

        self._collection = self._client.get_or_create_collection(
            name=collection,
            embedding_function=None,
        )

    # ------------------------------------------------------------------
    def add(self, chunks: list[dict]) -> None:
        """Upsert chunks so re-ingesting the same file is idempotent."""
        if not chunks:
            return

        ids = [c["chunk_id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [{"source": c["source"], "page": c["page"]} for c in chunks]
        embeddings = self._embedder.embed(documents)

        self._collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        logger.debug("Upserted %d chunks into collection '%s'", len(chunks), self._collection_name)

    # ------------------------------------------------------------------
    def query(self, text: str, k: int = 4) -> list[dict]:
        """Return up to k nearest chunks with score = 1 - cosine_distance."""
        if self._collection.count() == 0:
            return []

        query_embedding = self._embedder.embed([text])[0]
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=min(k, self._collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        output: list[dict] = []
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]

        for doc, meta, dist, chunk_id in zip(docs, metas, distances, ids):
            output.append(
                {
                    "text": doc,
                    "source": meta.get("source", ""),
                    "page": meta.get("page", 1),
                    "score": 1.0 - dist,
                    "chunk_id": chunk_id,
                }
            )
        return output

    # ------------------------------------------------------------------
    def count(self) -> int:
        return self._collection.count()

    # ------------------------------------------------------------------
    def reset(self) -> None:
        self._client.delete_collection(self._collection_name)
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            embedding_function=None,
        )
        logger.info("Collection '%s' reset.", self._collection_name)
