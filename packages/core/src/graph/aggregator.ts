import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { State } from "./state.js";
import type { Citation } from "./state.js";

function isAi(m: BaseMessage): boolean {
  return m._getType() === "ai";
}

function formatCitationsFooter(citations: Citation[]): string {
  const lines = citations.map((c) => {
    const page = c.page !== undefined ? ` p.${c.page}` : "";
    return `[${c.source}${page}] — chunk ${c.chunkIndex} (score: ${c.score.toFixed(3)})`;
  });
  return "\n\n---\nSources :\n" + lines.join("\n");
}

export function aggregatorNode(state: State): Partial<State> {
  if (state.quiz !== undefined) {
    const payload = {
      kind: "quiz",
      quiz: state.quiz,
      citations: state.citations,
    };
    return {
      messages: [new AIMessage(JSON.stringify(payload))],
    };
  }

  const messages = state.messages;
  const lastAi = [...messages].reverse().find(isAi);

  if (lastAi === undefined) {
    return {};
  }

  const baseContent =
    typeof lastAi.content === "string"
      ? lastAi.content
      : JSON.stringify(lastAi.content);

  const finalContent =
    state.citations.length > 0
      ? baseContent + formatCitationsFooter(state.citations)
      : baseContent;

  return {
    messages: [new AIMessage(finalContent)],
  };
}
