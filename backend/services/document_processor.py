"""Extract text from PDF/MD/TXT files and split it into overlapping chunks."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Iterable, Optional

import fitz  # PyMuPDF

from config import get_settings


@dataclass
class Chunk:
    text: str
    source: str
    page: Optional[int]
    chunk_index: int


# ---------- Extraction ----------

def extract_text(path: str) -> list[tuple[str, Optional[int]]]:
    """Return a list of (text, page) tuples for the file.

    For PDF, one tuple per page. For MD/TXT, one tuple with page=None.
    """
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return _extract_pdf(path)
    if ext in (".md", ".markdown", ".txt"):
        return _extract_text_file(path)
    raise ValueError(f"Unsupported file extension: {ext}")


def _extract_pdf(path: str) -> list[tuple[str, Optional[int]]]:
    out: list[tuple[str, Optional[int]]] = []
    with fitz.open(path) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            text = _clean(text)
            if text.strip():
                out.append((text, page_num))
    return out


def _extract_text_file(path: str) -> list[tuple[str, Optional[int]]]:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    text = _clean(text)
    return [(text, None)] if text.strip() else []


# ---------- Cleaning ----------

_WS_RE = re.compile(r"[ \t]+")
_NEWLINES_RE = re.compile(r"\n{3,}")
_PAGE_NUMBER_RE = re.compile(r"^\s*\d{1,3}\s*$", re.MULTILINE)


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _PAGE_NUMBER_RE.sub("", text)
    text = _WS_RE.sub(" ", text)
    text = _NEWLINES_RE.sub("\n\n", text)
    return text.strip()


# ---------- Chunking ----------

def _approx_tokens(text: str) -> int:
    """Rough proxy: ~0.75 tokens per word."""
    return max(1, int(len(text.split()) / 0.75))


def chunk_text(
    text: str,
    source: str,
    page: Optional[int],
    start_index: int,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
    min_chunk_size: Optional[int] = None,
) -> tuple[list[Chunk], int]:
    """Split text into overlapping chunks of approximately chunk_size tokens.

    Returns (chunks, next_index).
    """
    settings = get_settings()
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap
    min_chunk_size = min_chunk_size or settings.min_chunk_size

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return [], start_index

    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_tokens = 0
    idx = start_index

    def flush() -> None:
        nonlocal buf, buf_tokens, idx
        if not buf:
            return
        chunk_str = "\n\n".join(buf).strip()
        if _approx_tokens(chunk_str) >= min_chunk_size or not chunks:
            chunks.append(Chunk(text=chunk_str, source=source, page=page, chunk_index=idx))
            idx += 1
        buf, buf_tokens = [], 0

    for para in paragraphs:
        para_tokens = _approx_tokens(para)
        if buf_tokens + para_tokens <= chunk_size:
            buf.append(para)
            buf_tokens += para_tokens
            continue
        # Para alone is bigger than chunk_size -> split by sentences.
        if para_tokens > chunk_size:
            flush()
            sentences = re.split(r"(?<=[.!?])\s+", para)
            sbuf: list[str] = []
            sbuf_tokens = 0
            for sent in sentences:
                t = _approx_tokens(sent)
                if sbuf_tokens + t > chunk_size and sbuf:
                    chunks.append(
                        Chunk(text=" ".join(sbuf).strip(), source=source, page=page, chunk_index=idx)
                    )
                    idx += 1
                    overlap_tokens = 0
                    overlap_buf: list[str] = []
                    for s in reversed(sbuf):
                        overlap_tokens += _approx_tokens(s)
                        overlap_buf.insert(0, s)
                        if overlap_tokens >= chunk_overlap:
                            break
                    sbuf = overlap_buf
                    sbuf_tokens = overlap_tokens
                sbuf.append(sent)
                sbuf_tokens += t
            if sbuf:
                buf = [" ".join(sbuf).strip()]
                buf_tokens = sbuf_tokens
        else:
            flush()
            buf = [para]
            buf_tokens = para_tokens

    flush()
    return chunks, idx


def process_file(path: str) -> list[Chunk]:
    """Full pipeline: extract + clean + chunk for a single file."""
    pages = extract_text(path)
    source = os.path.basename(path)
    all_chunks: list[Chunk] = []
    idx = 0
    for text, page in pages:
        new_chunks, idx = chunk_text(text, source=source, page=page, start_index=idx)
        all_chunks.extend(new_chunks)
    return all_chunks


def iter_chunks_for_chroma(chunks: Iterable[Chunk]) -> tuple[list[str], list[str], list[dict]]:
    """Convert Chunk objects into the parallel lists ChromaDB expects."""
    ids: list[str] = []
    docs: list[str] = []
    metas: list[dict] = []
    for c in chunks:
        meta: dict = {"source": c.source, "chunk_index": c.chunk_index}
        if c.page is not None:
            meta["page"] = c.page
        ids.append(f"{c.source}::chunk_{c.chunk_index}")
        docs.append(c.text)
        metas.append(meta)
    return ids, docs, metas
