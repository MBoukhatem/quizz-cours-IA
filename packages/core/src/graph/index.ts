import { HumanMessage } from "@langchain/core/messages";
import type { StreamEvent } from "@langchain/core/tracers/log_stream";
import { buildGraph } from "./graph.js";
import { QuizSchema } from "../tools/schemas.js";
import type { Quiz } from "../tools/schemas.js";
import type { GraphEvent } from "./events.js";
import type { State, Citation } from "./state.js";

export { buildGraph } from "./graph.js";
export { GraphState } from "./state.js";
export type { State, Citation } from "./state.js";
export type { GraphEvent } from "./events.js";
export { formatEvent } from "./events.js";

type CompiledGraph = ReturnType<typeof buildGraph>;

export interface RunChatOptions {
  threadId: string;
  userMessage: string;
  sourceFilter?: string;
  numQuestions?: number;
}

function extractCitationsFromState(state: Partial<State>): Citation[] {
  return state.citations ?? [];
}

export async function* runChat(
  graph: CompiledGraph,
  opts: RunChatOptions
): AsyncGenerator<GraphEvent> {
  const config = {
    configurable: { thread_id: opts.threadId },
    version: "v2" as const,
  };

  const input = {
    messages: [new HumanMessage(opts.userMessage)],
    sourceFilter: opts.sourceFilter,
    numQuestions: opts.numQuestions,
  };

  // streamEvents v2 emits fine-grained LangGraph + LangChain core events.
  // Chosen over stream() / streamMode="updates" because it surfaces:
  //   - on_chain_end per node (for router.decision, rag.docs)
  //   - on_tool_start / on_tool_end (for tool.call / tool.result)
  //   - on_chat_model_stream (for final.token streaming)
  // See: https://langchain-ai.github.io/langgraphjs/concepts/streaming/
  const eventStream = graph.streamEvents(input, config);

  let finalState: Partial<State> = {};

  for await (const event of eventStream) {
    const e = event as StreamEvent & {
      metadata?: { langgraph_node?: string };
      data?: {
        output?: unknown;
        input?: { name?: string; input?: unknown };
        chunk?: { content?: string };
      };
    };

    const node: string = e.metadata?.langgraph_node ?? "";

    if (e.event === "on_chain_end" && e.name === "router") {
      const output = e.data?.output as Partial<State> | undefined;
      if (output?.route && output?.intent) {
        yield {
          type: "router.decision",
          route: output.route,
          intent: output.intent,
          reason: "",
        };
      }
    }

    if (e.event === "on_chain_end" && e.name === "rag_agent") {
      const output = e.data?.output as Partial<State> | undefined;
      const citations = extractCitationsFromState(output ?? {});
      if (citations.length > 0) {
        yield { type: "rag.docs", citations };
      }
      if (output) {
        Object.assign(finalState, output);
      }
    }

    if (e.event === "on_tool_start") {
      const toolInput = e.data?.input;
      yield {
        type: "tool.call",
        name: e.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool input shape is open-ended at runtime
        args: (toolInput as Record<string, unknown>) ?? {},
      };
    }

    if (e.event === "on_tool_end") {
      const result = e.data?.output;
      yield {
        type: "tool.result",
        name: e.name,
        result: typeof result === "string" ? result : JSON.stringify(result),
      };
    }

    if (e.event === "on_chat_model_stream" && node === "aggregator") {
      const chunk = e.data?.chunk as { content?: string } | undefined;
      const token = chunk?.content;
      if (typeof token === "string" && token.length > 0) {
        yield { type: "final.token", token };
      }
    }

    if (e.event === "on_chain_end" && e.name === "aggregator") {
      const output = e.data?.output as Partial<State> | undefined;
      if (output) {
        Object.assign(finalState, output);
      }
    }
  }

  const citations = extractCitationsFromState(finalState);
  const messages = finalState.messages ?? [];
  const lastMsg = [...messages].reverse().find((m) => m._getType() === "ai");
  const rawText =
    typeof lastMsg?.content === "string"
      ? lastMsg.content
      : JSON.stringify(lastMsg?.content ?? "");

  if (finalState.quiz !== undefined) {
    yield {
      type: "final.done",
      payload: { quiz: finalState.quiz, citations },
    };
    return;
  }

  let quiz: Quiz | undefined;
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.kind === "quiz" && parsed.quiz) {
      quiz = QuizSchema.parse(parsed.quiz);
    }
  } catch {
    // not a quiz payload — treat as plain text
  }

  yield {
    type: "final.done",
    payload: quiz
      ? { quiz, citations }
      : { text: rawText, citations },
  };
}
