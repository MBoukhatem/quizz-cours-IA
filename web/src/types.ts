export type Thought = {
  stage: string;
  content: string;
};

export type QuizQuestion = {
  question: string;
  type?: string | null;
  options?: string[] | null;
  answer?: string | null;
  explanation?: string | null;
  source?: string | null;
};

export type Quiz = {
  topic?: string | null;
  questions: QuizQuestion[];
};

export type QueryResponse = {
  thoughts: Thought[];
  final_answer: string;
  quiz?: Quiz | null;
  sanitized_query: string;
  injection_detected: boolean;
};

export type StatusResponse = {
  chunks: number;
  history_size: number;
  model: string;
  available_models: string[];
  store_mode: string;
};

export type ModelsResponse = {
  current: string;
  available: string[];
};

export type ChatMessage =
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
      quiz?: Quiz | null;
      thoughts?: Thought[];
      injectionDetected?: boolean;
    }
  | {
      role: "system";
      content: string;
      kind: "info" | "error";
    };
