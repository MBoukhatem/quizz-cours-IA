"""Streamlit entry page: lands on a dashboard-like overview and routes to subpages."""
from __future__ import annotations

import os

import requests
import streamlit as st

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

st.set_page_config(
    page_title="Tuteur Quiz Adaptatif",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🎓 Tuteur Quiz Adaptatif")
st.caption(
    "Agent IA local pour réviser vos cours par QCM générés à partir de votre propre corpus."
)

with st.sidebar:
    st.header("Navigation")
    st.markdown(
        "- **📤 Upload** : ajouter un cours\n"
        "- **🎯 Quiz** : lancer une session de révision\n"
        "- **📊 Dashboard** : suivre votre progression\n"
    )
    st.markdown("---")
    st.caption("Backend:")
    st.code(BACKEND_URL)

st.markdown("## Statut du système")
col1, col2 = st.columns(2)

try:
    health = requests.get(f"{BACKEND_URL}/api/health", timeout=10).json()
    status = health.get("status", "unknown")
    components = health.get("components", [])
    if status == "ok":
        col1.success(f"Système : {status.upper()}")
    elif status == "degraded":
        col1.warning(f"Système : {status.upper()}")
    else:
        col1.error(f"Système : {status.upper()}")
    for c in components:
        icon = "✅" if c["healthy"] else "❌"
        col2.write(f"{icon} **{c['name']}** — {c['detail']}")
except Exception as exc:
    col1.error(f"Backend injoignable : {exc}")

st.markdown("---")
st.markdown("## Pour commencer")
st.markdown(
    """
1. Ouvrez la page **📤 Upload** dans la barre latérale pour ajouter un cours (PDF, MD ou TXT).
2. Passez à **🎯 Quiz** pour générer une question à partir de votre corpus.
3. Consultez vos résultats dans **📊 Dashboard**.
"""
)

try:
    summary = requests.get(f"{BACKEND_URL}/api/stats/summary", timeout=10).json()
    st.markdown("### Aperçu rapide")
    a, b, c, d = st.columns(4)
    a.metric("Documents indexés", summary.get("documents_indexed", 0))
    b.metric("Chunks", summary.get("total_chunks", 0))
    c.metric("Questions répondues", summary.get("total_questions", 0))
    d.metric("Taux de réussite", f"{summary.get('success_rate', 0)} %")
except Exception:
    pass
