"""Quiz page: generate, answer, get feedback, loop."""
from __future__ import annotations

import os
import sys
import uuid

import requests
import streamlit as st

# Allow importing the components/ package when streamlit imports this page.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from components.quiz_card import render_feedback, render_question  # noqa: E402

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

st.set_page_config(page_title="Quiz — Tuteur Quiz", page_icon="🎯", layout="wide")
st.title("🎯 Session de quiz")

if "session_id" not in st.session_state:
    st.session_state.session_id = f"sess_{uuid.uuid4().hex[:8]}"
if "current_question" not in st.session_state:
    st.session_state.current_question = None
if "last_feedback" not in st.session_state:
    st.session_state.last_feedback = None

with st.sidebar:
    st.markdown(f"**Session :** `{st.session_state.session_id}`")
    if st.button("🔄 Nouvelle session"):
        st.session_state.session_id = f"sess_{uuid.uuid4().hex[:8]}"
        st.session_state.current_question = None
        st.session_state.last_feedback = None
        st.rerun()
    forced = st.selectbox(
        "Difficulté forcée (optionnel)",
        options=["auto", "facile", "moyen", "difficile"],
        index=0,
    )
    st.markdown("---")
    try:
        docs = requests.get(f"{BACKEND_URL}/api/documents", timeout=5).json().get("documents", [])
    except Exception:
        docs = []
    doc_choice = st.selectbox(
        "Document (optionnel)",
        options=["tous"] + [d["filename"] for d in docs],
        index=0,
    )
    doc_id_map = {d["filename"]: d["document_id"] for d in docs}
    selected_doc_id = doc_id_map.get(doc_choice) if doc_choice != "tous" else None


def _generate() -> None:
    payload = {"session_id": st.session_state.session_id}
    if forced != "auto":
        payload["difficulty"] = forced
    if selected_doc_id:
        payload["document_id"] = selected_doc_id
    with st.spinner("Génération en cours via Ollama..."):
        resp = requests.post(f"{BACKEND_URL}/api/quiz/generate", json=payload, timeout=180)
    if resp.status_code == 200:
        st.session_state.current_question = resp.json()
        st.session_state.last_feedback = None
    else:
        st.error(f"Erreur {resp.status_code} : {resp.text}")


col_left, col_right = st.columns([3, 1])
with col_right:
    if st.button("🆕 Nouvelle question", use_container_width=True):
        _generate()

question = st.session_state.current_question
feedback = st.session_state.last_feedback

if question is None and feedback is None:
    st.info("Cliquez sur **Nouvelle question** pour démarrer.")
else:
    if feedback is not None:
        render_feedback(feedback)
        st.markdown("---")
        if st.button("➡️ Question suivante"):
            _generate()
            st.rerun()
    elif question is not None:
        idx = render_question(question)
        if st.button("Valider ma réponse", disabled=idx is None):
            payload = {
                "question_id": question["question_id"],
                "session_id": st.session_state.session_id,
                "selected_index": idx,
            }
            with st.spinner("Correction en cours..."):
                resp = requests.post(f"{BACKEND_URL}/api/quiz/answer", json=payload, timeout=180)
            if resp.status_code == 200:
                st.session_state.last_feedback = resp.json()
                st.rerun()
            else:
                st.error(f"Erreur {resp.status_code} : {resp.text}")
