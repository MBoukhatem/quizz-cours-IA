import React from "react";
import { Text } from "ink";
import type { GraphEvent, Citation, Quiz } from "@quizz/core";

function citationSummary(citations: Citation[]): string {
  const parts = citations.slice(0, 5).map((c) => {
    const page = c.page !== undefined ? ` p.${c.page}` : "";
    return `${c.source}${page}`;
  });
  const suffix = citations.length > 5 ? ` +${citations.length - 5} more` : "";
  return parts.join(", ") + suffix;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function argsString(args: Record<string, unknown>): string {
  const pairs = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
    .join(", ");
  return pairs;
}

function quizSummary(quiz: Quiz): string {
  const lines = [`topic="${quiz.topic}" (${quiz.questions.length} questions)`];
  quiz.questions.forEach((q, i) => {
    lines.push(`  Q${i + 1}: ${truncate(q.question, 80)}`);
  });
  return lines.join("\n");
}

export function renderEvent(event: GraphEvent): React.ReactElement | null {
  switch (event.type) {
    case "router.decision": {
      const label = `[Routeur] route=${event.route} intent=${event.intent}`;
      const reason = event.reason ? ` — raison: ${event.reason}` : "";
      return (
        <Text color="cyan">
          {label}
          {reason}
        </Text>
      );
    }

    case "rag.docs": {
      const count = event.citations.length;
      const summary =
        count > 0 ? ` (${citationSummary(event.citations)})` : "";
      return (
        <Text color="green">
          {`[RAG]     ${count} chunk${count !== 1 ? "s" : ""} récupéré${count !== 1 ? "s" : ""}${summary}`}
        </Text>
      );
    }

    case "tool.call": {
      const args = argsString(event.args);
      return (
        <Text color="yellow">{`[Outil]   ${event.name}(${args})`}</Text>
      );
    }

    case "tool.result": {
      const preview = truncate(event.result, 80);
      return (
        <Text color="yellow" dimColor>
          {`[Outil]   ${event.name} → ${preview}`}
        </Text>
      );
    }

    case "final.token":
      return null;

    case "final.done": {
      const content = event.payload.quiz
        ? quizSummary(event.payload.quiz)
        : (event.payload.text ?? "");
      return (
        <Text color="magenta">{`[Final]   ${content}`}</Text>
      );
    }
  }
}
