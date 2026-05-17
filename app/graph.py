from __future__ import annotations

import functools
import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.llm import OllamaClient
from app.rag.agent import rag_node
from app.rag.vectorstore import VectorStore
from app.router import router_node
from app.state import GraphState
from app.tools.agent import tools_node

logger = logging.getLogger(__name__)


def finalizer(state: GraphState) -> GraphState:
    thoughts: list[dict] = list(state.get("thoughts") or [])
    quiz = state.get("quiz")

    if quiz:
        lines: list[str] = [f"Quiz: {quiz.get('topic', '')}"]
        for i, q in enumerate(quiz.get("questions", []), start=1):
            lines.append(f"{i}. {q.get('question', '')} [{q.get('type', '')}]")
            for opt in q.get("options") or []:
                lines.append(f"   {opt}")
            lines.append(f"   Réponse: {q.get('answer', '')}")
            lines.append(f"   Explication: {q.get('explanation', '')}")
            source = q.get("source")
            if source:
                lines.append(f"   Source: {source}")
        rendered = "\n".join(lines)
        state = {**state, "final_answer": rendered}  # type: ignore[assignment]
    else:
        rendered = state.get("final_answer") or ""

    thoughts.append({"stage": "Final", "content": rendered[:120]})
    state = {**state, "thoughts": thoughts}  # type: ignore[assignment]
    return state  # type: ignore[return-value]


def build_graph(llm: OllamaClient, store: VectorStore) -> Any:
    graph = StateGraph(GraphState)

    bound_router = functools.partial(router_node, llm=llm, store=store)
    bound_rag = functools.partial(rag_node, store=store, llm=llm)
    bound_tools = functools.partial(tools_node, llm=llm)

    graph.add_node("router", bound_router)
    graph.add_node("rag", bound_rag)
    graph.add_node("tools", bound_tools)
    graph.add_node("finalizer", finalizer)

    graph.add_edge(START, "router")
    graph.add_conditional_edges(
        "router",
        lambda state: state["route"],
        {"rag": "rag", "tools": "tools"},
    )
    graph.add_edge("rag", "finalizer")
    graph.add_edge("tools", "finalizer")
    graph.add_edge("finalizer", END)

    return graph.compile()
