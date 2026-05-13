from __future__ import annotations

from typing import Literal, Optional, TypedDict

from langgraph.graph.message import add_messages
from typing_extensions import Annotated


class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    user_query: str
    route: Optional[Literal["rag", "tools"]]
    rag_context: Optional[list[dict]]
    tool_results: Optional[list[dict]]
    quiz: Optional[dict]
    final_answer: Optional[str]
    thoughts: list[dict]


def initial_state(user_query: str, history: list[dict]) -> GraphState:
    return GraphState(
        messages=history + [{"role": "user", "content": user_query}],
        user_query=user_query,
        route=None,
        rag_context=None,
        tool_results=None,
        quiz=None,
        final_answer=None,
        thoughts=[],
    )
