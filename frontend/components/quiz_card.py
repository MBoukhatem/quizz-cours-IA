"""Reusable quiz-card renderer."""
from __future__ import annotations

import streamlit as st


def render_question(question: dict) -> int | None:
    """Render the question + 4 choice buttons. Returns the selected index or None."""
    st.markdown(f"### {question['question']}")
    st.caption(
        f"Difficulté : **{question['difficulty']}** · Source : *{question['source_document']}*"
        + (f" (p. {question['source_page']})" if question.get("source_page") else "")
    )
    selected = st.radio(
        "Votre réponse :",
        options=list(range(4)),
        format_func=lambda i: f"{'ABCD'[i]}. {question['choices'][i]}",
        index=None,
        key=f"radio_{question['question_id']}",
    )
    return selected


def render_feedback(feedback: dict) -> None:
    if feedback["is_correct"]:
        st.success("✅ Bonne réponse !")
    else:
        st.error("❌ Réponse incorrecte.")
    st.markdown(f"**Explication.** {feedback['explanation']}")
    st.caption(f"📖 Source : {feedback['source_reference']}")
    col1, col2, col3 = st.columns(3)
    col1.metric("Score session", f"{feedback['score_session']} / {feedback['total_session']}")
    col2.metric("Difficulté actuelle", feedback["new_difficulty"])
    rate = (
        round(100 * feedback["score_session"] / feedback["total_session"], 1)
        if feedback["total_session"]
        else 0.0
    )
    col3.metric("Réussite", f"{rate} %")
