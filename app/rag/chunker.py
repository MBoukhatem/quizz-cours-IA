from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def chunk_documents(
    docs: list[dict],
    chunk_size: int = 800,
    overlap: int = 100,
) -> list[dict]:
    """Split docs into overlapping character-based chunks.

    Each output dict contains: text, source, page, chunk_id.
    """
    chunks: list[dict] = []

    for doc in docs:
        text: str = doc["text"]
        source: str = doc["source"]
        page: int = doc["page"]

        if len(text) <= chunk_size:
            chunk_id = f"{source}#{page}#0"
            chunks.append(
                {"text": text.strip(), "source": source, "page": page, "chunk_id": chunk_id}
            )
            continue

        idx = 0
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunk_id = f"{source}#{page}#{idx}"
                chunks.append(
                    {
                        "text": chunk_text,
                        "source": source,
                        "page": page,
                        "chunk_id": chunk_id,
                    }
                )
                idx += 1
            start += chunk_size - overlap

    logger.debug("Chunked %d docs into %d chunks", len(docs), len(chunks))
    return chunks
