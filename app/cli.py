from __future__ import annotations

import logging

from rich.console import Console
from rich.panel import Panel

from app.rag.chunker import chunk_documents
from app.rag.loader import load_document
from app.rag.vectorstore import VectorStore
from app.security.prompt_guard import is_injection, sanitize_user_input
from app.state import initial_state

logger = logging.getLogger(__name__)

_STAGE_COLORS: dict[str, str] = {
    "Routeur": "cyan",
    "RAG": "green",
    "Outil": "yellow",
    "Final": "magenta",
}

_HELP_TEXT = """\
Commandes disponibles:
  /ingest <chemin>  Ingère un document (PDF, DOCX, TXT, MD)
  /reset            Vide la mémoire et le store
  /status           Affiche l'état (store, mémoire, modèle)
  /help             Affiche ce message
  /quit ou /exit    Quitter
  <texte>           Toute autre entrée est traitée comme une requête
"""


class ThoughtRenderer:
    def __init__(self, console: Console) -> None:
        self._console = console

    def render(self, stage: str, content: str) -> None:
        color = _STAGE_COLORS.get(stage, "dim white")
        self._console.print(f"[bold {color}][{stage}][/bold {color}] {content}")


def run_repl(graph: object, memory: object, store: VectorStore) -> None:
    console = Console()

    fallback_info = "chroma (fallback local)" if store.using_fallback else "chroma (HTTP)"

    console.print(
        Panel(
            f"[bold]quizz-cours-IA[/bold]\n"
            f"Store: {fallback_info}  |  Tapez /help pour les commandes",
            title="Bienvenue",
            border_style="blue",
        )
    )

    renderer = ThoughtRenderer(console)

    while True:
        try:
            raw_input = input("> ")
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Au revoir.[/dim]")
            break

        line = raw_input.strip()
        if not line:
            continue

        if line in ("/quit", "/exit"):
            console.print("[dim]Au revoir.[/dim]")
            break

        if line == "/help":
            console.print(_HELP_TEXT)
            continue

        if line == "/reset":
            store.reset()
            memory.clear()  # type: ignore[attr-defined]
            console.print("[green]Mémoire et store réinitialisés.[/green]")
            continue

        if line == "/status":
            console.print(
                f"Store: {store.count()} chunks  |  "
                f"Mémoire: {len(memory.history())} messages"  # type: ignore[attr-defined]
            )
            continue

        if line.startswith("/ingest "):
            path = line[len("/ingest "):].strip()
            if not path:
                console.print("[red]Usage: /ingest <chemin>[/red]")
                continue
            try:
                import os
                if not os.path.exists(path):
                    console.print(f"[red]Fichier introuvable: {path}[/red]")
                    continue
                docs = load_document(path)
                chunks = chunk_documents(docs)
                store.add(chunks)
                console.print(f"[green]{len(chunks)} chunks ingérés depuis {path}[/green]")
            except Exception as exc:
                console.print(f"[red]Erreur lors de l'ingestion: {exc}[/red]")
            continue

        # treat as query
        sanitized = sanitize_user_input(line)
        detected, _pattern = is_injection(line)
        if detected:
            renderer.render("Outil", "[AVERTISSEMENT] Tentative d'injection détectée — requête nettoyée.")

        state = initial_state(sanitized, memory.history())  # type: ignore[attr-defined]

        try:
            result = graph.invoke(state)  # type: ignore[attr-defined]
        except Exception as exc:
            console.print(f"[red]Erreur lors de l'exécution: {exc}[/red]")
            logger.exception("Graph invoke error")
            continue

        for thought in result.get("thoughts", []):
            renderer.render(thought.get("stage", ""), thought.get("content", ""))

        final = result.get("final_answer") or ""
        console.print(Panel(final, title="Réponse", border_style="green"))

        memory.add("user", sanitized)  # type: ignore[attr-defined]
        memory.add("assistant", final)  # type: ignore[attr-defined]
