from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer as _ST

logger = logging.getLogger(__name__)


class Embedder:
    """Lazy-loading wrapper around sentence_transformers.SentenceTransformer."""

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model: _ST | None = None

    def _load(self) -> _ST:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s", self._model_name)
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        model = self._load()
        vectors = model.encode(texts, show_progress_bar=False)
        return [v.tolist() for v in vectors]

    @property
    def dim(self) -> int:
        model = self._load()
        return model.get_sentence_embedding_dimension()
