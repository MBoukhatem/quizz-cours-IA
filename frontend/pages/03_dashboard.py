"""Dashboard page: global score, per-session progression, per-topic breakdown."""
from __future__ import annotations

import os
import sys

import requests
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from components.progress_chart import session_progress_chart, topics_chart  # noqa: E402

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

st.set_page_config(page_title="Dashboard — Tuteur Quiz", page_icon="📊", layout="wide")
st.title("📊 Tableau de bord")

# ----- Summary metrics -----
try:
    summary = requests.get(f"{BACKEND_URL}/api/stats/summary", timeout=10).json()
except Exception as exc:
    st.error(f"Impossible de charger les statistiques : {exc}")
    st.stop()

col1, col2, col3, col4 = st.columns(4)
col1.metric("Questions répondues", summary.get("total_questions", 0))
col2.metric("Bonnes réponses", summary.get("correct_answers", 0))
col3.metric("Taux de réussite", f"{summary.get('success_rate', 0)} %")
col4.metric("Difficulté actuelle", summary.get("current_difficulty", "facile"))

col1, col2, col3 = st.columns(3)
col1.metric("Sessions", summary.get("sessions_count", 0))
col2.metric("Documents", summary.get("documents_indexed", 0))
col3.metric("Chunks indexés", summary.get("total_chunks", 0))

st.markdown("---")

# ----- Charts -----
try:
    history = requests.get(f"{BACKEND_URL}/api/stats/history", timeout=10).json()
    sessions = history.get("sessions", [])
except Exception:
    sessions = []

try:
    topics_resp = requests.get(f"{BACKEND_URL}/api/stats/topics", timeout=10).json()
    topics = topics_resp.get("topics", [])
except Exception:
    topics = []

c1, c2 = st.columns(2)
with c1:
    if sessions:
        st.plotly_chart(session_progress_chart(sessions), use_container_width=True)
    else:
        st.info("Pas encore de session terminée.")

with c2:
    if topics:
        st.plotly_chart(topics_chart(topics), use_container_width=True)
    else:
        st.info("Pas encore de question répondue.")

st.markdown("---")
st.subheader("Historique des sessions")
if sessions:
    st.dataframe(
        [
            {
                "Session": s["session_id"],
                "Démarrée": s["started_at"],
                "Questions": s["total_questions"],
                "Correctes": s["correct_answers"],
                "Réussite (%)": s["success_rate"],
            }
            for s in sessions
        ],
        use_container_width=True,
        hide_index=True,
    )
else:
    st.caption("Aucune session enregistrée.")
