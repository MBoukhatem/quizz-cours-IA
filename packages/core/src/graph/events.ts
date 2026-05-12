import type { Citation } from "./state.js";
import type { Quiz } from "../tools/schemas.js";

export type GraphEvent =
  | { type: "router.decision"; route: "rag" | "tools"; intent: "answer" | "quiz"; reason: string }
  | { type: "rag.docs"; citations: Citation[] }
  | { type: "tool.call"; name: string; args: Record<string, unknown> }
  | { type: "tool.result"; name: string; result: string }
  | { type: "final.token"; token: string }
  | { type: "final.done"; payload: { text?: string; quiz?: Quiz; citations: Citation[] } };

export function formatEvent(e: GraphEvent): string {
  switch (e.type) {
    case "router.decision":
      return `[router] route=${e.route} intent=${e.intent} reason="${e.reason}"`;
    case "rag.docs":
      return `[rag] ${e.citations.length} source(s) retrieved`;
    case "tool.call":
      return `[tool.call] ${e.name}(${JSON.stringify(e.args)})`;
    case "tool.result":
      return `[tool.result] ${e.name}: ${e.result.slice(0, 120)}`;
    case "final.token":
      return e.token;
    case "final.done":
      return e.payload.quiz
        ? `[done] quiz "${e.payload.quiz.topic}" (${e.payload.quiz.questions.length} questions)`
        : `[done] ${(e.payload.text ?? "").slice(0, 80)}`;
  }
}
