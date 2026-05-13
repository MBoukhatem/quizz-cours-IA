from __future__ import annotations

import json

import pytest

from tests.conftest import make_fake_llm


# ---------------------------------------------------------------------------
# test_rag_nominal_ingests_and_queries
# ---------------------------------------------------------------------------

def test_rag_nominal_ingests_and_queries(tmp_chroma):
    from app.rag.chunker import chunk_documents
    from app.rag.loader import load_document

    docs = load_document("data/samples/lecture_ml.md")
    chunks = chunk_documents(docs)
    tmp_chroma.add(chunks)

    results = tmp_chroma.query("supervised learning", k=4)
    assert len(results) >= 1
    for chunk in results:
        assert "source" in chunk
        assert "page" in chunk
        assert isinstance(chunk["score"], float)


# ---------------------------------------------------------------------------
# test_rag_edge_off_topic
# ---------------------------------------------------------------------------

def test_rag_edge_off_topic(tmp_chroma):
    from app.rag.agent import rag_node
    from app.rag.chunker import chunk_documents
    from app.rag.loader import load_document
    from app.state import initial_state

    docs = load_document("data/samples/lecture_ml.md")
    chunks = chunk_documents(docs)
    tmp_chroma.add(chunks)

    llm = make_fake_llm()
    llm.enqueue("Le contexte ne contient pas la réponse.")

    state = initial_state("comment cuisiner des pâtes", [])
    result = rag_node(state, store=tmp_chroma, llm=llm)

    final = result.get("final_answer", "")
    assert "contexte" in final.lower() or "réponse" in final.lower()


# ---------------------------------------------------------------------------
# test_rag_error_empty_store
# ---------------------------------------------------------------------------

def test_rag_error_empty_store(tmp_chroma):
    from app.rag.agent import rag_node
    from app.state import initial_state

    llm = make_fake_llm()
    state = initial_state("Qu'est-ce que le machine learning?", [])
    result = rag_node(state, store=tmp_chroma, llm=llm)

    final = result.get("final_answer", "")
    assert "Aucun document pertinent" in final
