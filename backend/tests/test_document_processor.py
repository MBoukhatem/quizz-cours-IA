"""Unit tests for the document processor: extraction, cleaning, chunking."""
from __future__ import annotations

import os

from services.document_processor import (
    _clean,
    chunk_text,
    extract_text,
    process_file,
)


def test_clean_collapses_whitespace_and_strips_page_numbers():
    raw = "Title\n\n\n\n12\n\nBody text   with    spaces.\r\n\r\nNext."
    cleaned = _clean(raw)
    assert "12" not in cleaned.split()  # standalone "12" stripped
    assert "  " not in cleaned
    assert "Body text with spaces." in cleaned


def test_chunk_text_produces_chunks_with_metadata():
    text = "\n\n".join(["Paragraph " + str(i) + " " + ("mot " * 60) for i in range(10)])
    chunks, next_idx = chunk_text(text, source="cours.md", page=None, start_index=0)
    assert len(chunks) >= 2
    assert next_idx == len(chunks)
    for c in chunks:
        assert c.source == "cours.md"
        assert c.chunk_index >= 0
        assert c.text.strip()


def test_chunk_text_respects_chunk_size_roughly():
    text = ("mot " * 2000).strip()
    text = "\n\n".join([text[i : i + 400] for i in range(0, len(text), 400)])
    chunks, _ = chunk_text(text, source="x.txt", page=None, start_index=0, chunk_size=200)
    # Each chunk must stay around the requested size (approximate token count).
    for c in chunks:
        approx_tokens = max(1, int(len(c.text.split()) / 0.75))
        assert approx_tokens <= 350  # 200 + sentence overshoot tolerance


def test_extract_text_for_markdown(tmp_path):
    p = tmp_path / "cours.md"
    p.write_text("# Titre\n\nUn paragraphe.\n\nUn autre paragraphe.\n", encoding="utf-8")
    pages = extract_text(str(p))
    assert len(pages) == 1
    text, page_num = pages[0]
    assert page_num is None
    assert "paragraphe" in text


def test_process_file_end_to_end(tmp_path):
    p = tmp_path / "course.txt"
    body = "\n\n".join([f"Paragraph {i} with several words to fill the chunk." for i in range(50)])
    p.write_text(body, encoding="utf-8")
    chunks = process_file(str(p))
    assert len(chunks) >= 1
    assert all(c.source == os.path.basename(str(p)) for c in chunks)
