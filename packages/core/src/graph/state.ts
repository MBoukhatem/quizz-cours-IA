import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { RetrievalResult } from "../rag/retriever.js";
import type { Quiz } from "../tools/schemas.js";

export interface Citation {
  source: string;
  page?: number;
  chunkIndex: number;
  score: number;
}

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  route: Annotation<"rag" | "tools" | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  intent: Annotation<"answer" | "quiz" | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  retrieved: Annotation<RetrievalResult[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  quiz: Annotation<Quiz | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  citations: Annotation<Citation[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  iterations: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  sourceFilter: Annotation<string | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
  numQuestions: Annotation<number | undefined>({
    reducer: (_left, right) => right,
    default: () => undefined,
  }),
});

export type State = typeof GraphState.State;
