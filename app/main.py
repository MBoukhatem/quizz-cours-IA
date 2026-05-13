from __future__ import annotations

import logging
import sys

from dotenv import load_dotenv

load_dotenv()

from app.cli import run_repl
from app.config import get_settings
from app.graph import build_graph
from app.llm import make_client
from app.memory import ConversationMemory
from app.rag.embeddings import Embedder
from app.rag.vectorstore import VectorStore


def main() -> None:
    settings = get_settings()

    logging.basicConfig(
        level=getattr(logging, settings.app_log_level.upper(), logging.INFO),
        format="%(levelname)s %(name)s: %(message)s",
    )
    for noisy in ("httpx", "httpcore", "sentence_transformers", "chromadb"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    placeholder = "sk-or-v1-REPLACE_ME"
    key = settings.openrouter_api_key
    if not key or key == placeholder:
        print(
            "Erreur: OPENROUTER_API_KEY manquante ou non configurée.\n"
            "Copiez .env.example vers .env et renseignez votre clé OpenRouter.",
            file=sys.stderr,
        )
        sys.exit(2)

    llm = make_client(settings)
    embedder = Embedder(settings.embedding_model)
    store = VectorStore(
        host=settings.chroma_host,
        port=settings.chroma_port,
        collection=settings.chroma_collection,
        embedder=embedder,
    )
    memory = ConversationMemory(max_turns=settings.max_history_turns)
    graph = build_graph(llm, store)
    run_repl(graph, memory, store)


if __name__ == "__main__":
    main()
