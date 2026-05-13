from __future__ import annotations

import os
import logging

logger = logging.getLogger(__name__)

SUPPORTED_EXT = {".pdf", ".docx", ".txt", ".md"}


def load_document(path: str) -> list[dict]:
    """Return [{text, source, page}, ...]. PDF yields one dict per page."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")

    ext = os.path.splitext(path)[1].lower()
    if ext not in SUPPORTED_EXT:
        raise ValueError(f"Unsupported extension '{ext}'. Supported: {SUPPORTED_EXT}")

    source = os.path.basename(path)

    if ext == ".pdf":
        return _load_pdf(path, source)
    if ext == ".docx":
        return _load_docx(path, source)
    # .txt / .md
    return _load_text(path, source)


def _load_pdf(path: str, source: str) -> list[dict]:
    import pypdf  # lazy import: only required when loading PDFs

    reader = pypdf.PdfReader(path)
    docs: list[dict] = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            continue
        docs.append({"text": text, "source": source, "page": page_num})
    logger.debug("Loaded PDF %s: %d non-empty pages", source, len(docs))
    return docs


def _load_docx(path: str, source: str) -> list[dict]:
    import docx  # lazy import: only required when loading DOCX

    document = docx.Document(path)
    text = "\n".join(p.text for p in document.paragraphs)
    text = text.strip()
    logger.debug("Loaded DOCX %s: %d chars", source, len(text))
    return [{"text": text, "source": source, "page": 1}]


def _load_text(path: str, source: str) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        text = fh.read().strip()
    logger.debug("Loaded text %s: %d chars", source, len(text))
    return [{"text": text, "source": source, "page": 1}]
