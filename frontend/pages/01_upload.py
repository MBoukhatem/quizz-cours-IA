"""Upload page: drag & drop, list and delete documents."""
from __future__ import annotations

import os

import requests
import streamlit as st

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

st.set_page_config(page_title="Upload — Tuteur Quiz", page_icon="📤", layout="wide")
st.title("📤 Upload de cours")
st.caption("Formats supportés : PDF, Markdown (.md), texte (.txt). Indexation locale via ChromaDB.")


uploaded = st.file_uploader(
    "Glissez-déposez un ou plusieurs fichiers",
    type=["pdf", "md", "markdown", "txt"],
    accept_multiple_files=True,
)

if uploaded:
    for file in uploaded:
        with st.spinner(f"Indexation de {file.name}..."):
            try:
                resp = requests.post(
                    f"{BACKEND_URL}/api/upload",
                    files={"file": (file.name, file.getvalue(), file.type or "application/octet-stream")},
                    timeout=300,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    st.success(
                        f"✅ {data['filename']} indexé en {data['n_chunks']} chunks "
                        f"(id: `{data['document_id']}`)"
                    )
                else:
                    st.error(f"❌ {file.name} — {resp.status_code} : {resp.text}")
            except Exception as exc:
                st.error(f"❌ {file.name} — {exc}")

st.markdown("---")
st.subheader("📚 Documents indexés")

try:
    listing = requests.get(f"{BACKEND_URL}/api/documents", timeout=10).json()
    docs = listing.get("documents", [])
    if not docs:
        st.info("Aucun document indexé pour le moment.")
    else:
        for doc in docs:
            cols = st.columns([4, 1, 2, 1])
            cols[0].markdown(f"**{doc['filename']}**")
            cols[1].caption(f"{doc['n_chunks']} chunks")
            cols[2].caption(doc["uploaded_at"])
            if cols[3].button("Supprimer", key=f"del_{doc['document_id']}"):
                try:
                    r = requests.delete(
                        f"{BACKEND_URL}/api/documents/{doc['document_id']}", timeout=30
                    )
                    if r.status_code == 200:
                        st.success(f"Supprimé : {doc['filename']}")
                        st.rerun()
                    else:
                        st.error(f"Échec : {r.text}")
                except Exception as exc:
                    st.error(str(exc))
except Exception as exc:
    st.error(f"Impossible de lister les documents : {exc}")
