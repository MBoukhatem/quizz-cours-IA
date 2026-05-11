"""Plotly chart helpers for the dashboard."""
from __future__ import annotations

import plotly.express as px
import plotly.graph_objects as go


def session_progress_chart(sessions: list[dict]) -> go.Figure:
    """Line chart: success rate per session, ordered chronologically."""
    sessions_sorted = sorted(sessions, key=lambda s: s["started_at"])
    xs = [s["session_id"] for s in sessions_sorted]
    ys = [s["success_rate"] for s in sessions_sorted]
    fig = go.Figure(go.Scatter(x=xs, y=ys, mode="lines+markers", name="Taux de réussite"))
    fig.update_layout(
        title="Progression — taux de réussite par session",
        yaxis_title="Réussite (%)",
        xaxis_title="Session",
        yaxis_range=[0, 100],
        height=380,
    )
    return fig


def topics_chart(topics: list[dict]) -> go.Figure:
    if not topics:
        return go.Figure()
    fig = px.bar(
        topics,
        x="source_document",
        y="success_rate",
        text="success_rate",
        title="Performance par document",
        labels={"source_document": "Document", "success_rate": "Réussite (%)"},
    )
    fig.update_traces(texttemplate="%{text}%", textposition="outside")
    fig.update_layout(yaxis_range=[0, 110], height=380)
    return fig
