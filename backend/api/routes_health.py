"""Health-check endpoint: verifies Ollama and ChromaDB connectivity."""
from __future__ import annotations

from fastapi import APIRouter

from models.schemas import ComponentHealth, HealthResponse
from services.llm_client import get_llm_client
from services.vectorstore import get_vectorstore

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    components: list[ComponentHealth] = []

    # Ollama
    llm = get_llm_client()
    ollama_ok = await llm.ping()
    model_ok = await llm.model_available() if ollama_ok else False
    components.append(
        ComponentHealth(
            name="ollama",
            healthy=ollama_ok,
            detail=(
                f"model '{llm.model}' loaded" if model_ok
                else (
                    f"model '{llm.model}' not pulled — run scripts/init_ollama.sh"
                    if ollama_ok else "unreachable"
                )
            ),
        )
    )

    # ChromaDB
    try:
        store = get_vectorstore()
        chroma_ok = store.ping()
        chunks = store.total_chunks() if chroma_ok else 0
        components.append(
            ComponentHealth(
                name="chromadb",
                healthy=chroma_ok,
                detail=f"{chunks} chunks indexed" if chroma_ok else "unreachable",
            )
        )
    except Exception as exc:
        components.append(
            ComponentHealth(name="chromadb", healthy=False, detail=str(exc))
        )

    healthy_count = sum(1 for c in components if c.healthy)
    if healthy_count == len(components):
        status = "ok"
    elif healthy_count == 0:
        status = "down"
    else:
        status = "degraded"

    return HealthResponse(status=status, components=components)
