import { describe, it, expect, vi } from "vitest";
import { makeQuizEvaluatorTool } from "../src/tools/quiz_evaluator.js";
import type { ChatOpenAI } from "@langchain/openai";
import type { Quiz } from "../src/tools/schemas.js";
import { EvaluationResultSchema } from "../src/tools/schemas.js";

// ---------------------------------------------------------------------------
// Stub model — must NEVER be called in deterministic paths
// ---------------------------------------------------------------------------

function makeModelStub(): ChatOpenAI {
  const neverCalled = vi.fn(() => {
    throw new Error("LLM model must not be called in deterministic paths");
  });
  return {
    withStructuredOutput: neverCalled,
    invoke: neverCalled,
  } as unknown as ChatOpenAI;
}

// ---------------------------------------------------------------------------
// LangChain's tool().invoke() returns the raw object from the wrapped function.
// In @langchain/core ^0.3.x, DynamicStructuredTool.invoke() returns the value
// returned by the callback directly (object, not serialized string).
// We parse defensively to be robust against both outcomes.
// ---------------------------------------------------------------------------

type EvaluationResult = {
  items: Array<{ questionIndex: number; correct: boolean; score: number; feedback: string }>;
  totalScore: number;
  summary: string;
};

function parseResult(raw: unknown): EvaluationResult {
  if (typeof raw === "string") {
    return EvaluationResultSchema.parse(JSON.parse(raw));
  }
  return EvaluationResultSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Test quiz (only mcq + true_false — no open questions)
// ---------------------------------------------------------------------------

const deterministicQuiz: Quiz = {
  topic: "Bases de la programmation",
  difficulty: "facile",
  questions: [
    {
      type: "mcq",
      question: "Quel mot-clé déclare une constante en JavaScript ?",
      options: ["var", "let", "const", "def"],
      answerIndex: 2,
      explanation: "const déclare une liaison immuable.",
    },
    {
      type: "mcq",
      question: "Quel est le résultat de 2 + 2 en Python ?",
      options: ["22", "4", "2", "None"],
      answerIndex: 1,
      explanation: "En Python, 2 + 2 = 4.",
    },
    {
      type: "true_false",
      question: "Python est un langage compilé.",
      answer: false,
      explanation: "Python est interprété.",
    },
    {
      type: "true_false",
      question: "JavaScript peut s'exécuter dans un navigateur.",
      answer: true,
      explanation: "JavaScript est le langage natif des navigateurs.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function evaluate(
  answers: Array<{ questionIndex: number; answer: number | boolean | string }>
): Promise<EvaluationResult> {
  const model = makeModelStub();
  const evaluatorTool = makeQuizEvaluatorTool(model);
  const raw = await evaluatorTool.invoke({ quiz: deterministicQuiz, answers });
  return parseResult(raw);
}

// ---------------------------------------------------------------------------
// All correct
// ---------------------------------------------------------------------------

describe("quiz_evaluator — all correct answers", () => {
  it("does not call the LLM model", async () => {
    const model = makeModelStub();
    const evaluatorTool = makeQuizEvaluatorTool(model);
    await evaluatorTool.invoke({
      quiz: deterministicQuiz,
      answers: [
        { questionIndex: 0, answer: 2 },
        { questionIndex: 1, answer: 1 },
        { questionIndex: 2, answer: false },
        { questionIndex: 3, answer: true },
      ],
    });
    expect((model.withStructuredOutput as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("each item has score=1 and correct=true when all answers match", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 2 },
      { questionIndex: 1, answer: 1 },
      { questionIndex: 2, answer: false },
      { questionIndex: 3, answer: true },
    ]);
    for (const item of result.items) {
      expect(item.score).toBe(1);
      expect(item.correct).toBe(true);
    }
  });

  it("totalScore is 1 when every answer is correct", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 2 },
      { questionIndex: 1, answer: 1 },
      { questionIndex: 2, answer: false },
      { questionIndex: 3, answer: true },
    ]);
    expect(result.totalScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// All incorrect
// ---------------------------------------------------------------------------

describe("quiz_evaluator — all incorrect answers", () => {
  it("each item has score=0 and correct=false when all answers are wrong", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 0 },    // wrong (correct is 2)
      { questionIndex: 1, answer: 0 },    // wrong (correct is 1)
      { questionIndex: 2, answer: true },  // wrong (correct is false)
      { questionIndex: 3, answer: false }, // wrong (correct is true)
    ]);
    for (const item of result.items) {
      expect(item.score).toBe(0);
      expect(item.correct).toBe(false);
    }
  });

  it("totalScore is 0 when every answer is wrong", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 0 },
      { questionIndex: 1, answer: 0 },
      { questionIndex: 2, answer: true },
      { questionIndex: 3, answer: false },
    ]);
    expect(result.totalScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed answers
// ---------------------------------------------------------------------------

describe("quiz_evaluator — mixed answers", () => {
  it("computes totalScore as the mean of individual scores", async () => {
    // 2 correct out of 4 → totalScore = 0.5
    const result = await evaluate([
      { questionIndex: 0, answer: 2 },     // correct
      { questionIndex: 1, answer: 0 },     // wrong
      { questionIndex: 2, answer: false },  // correct
      { questionIndex: 3, answer: false },  // wrong
    ]);
    expect(result.totalScore).toBeCloseTo(0.5, 5);
  });

  it("returns the correct number of evaluated items", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 2 },
      { questionIndex: 1, answer: 0 },
    ]);
    expect(result.items).toHaveLength(2);
  });

  it("feedback field comes from the question's explanation for mcq", async () => {
    const result = await evaluate([{ questionIndex: 0, answer: 2 }]);
    const item = result.items.find((i) => i.questionIndex === 0);
    expect(item?.feedback).toBe(deterministicQuiz.questions[0]!.explanation);
  });

  it("feedback field comes from the question's explanation for true_false", async () => {
    const result = await evaluate([{ questionIndex: 2, answer: false }]);
    const item = result.items.find((i) => i.questionIndex === 2);
    expect(item?.feedback).toBe(deterministicQuiz.questions[2]!.explanation);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("quiz_evaluator — edge cases", () => {
  it("returns totalScore=0 and empty items when no answers are submitted", async () => {
    const result = await evaluate([]);
    expect(result.items).toHaveLength(0);
    expect(result.totalScore).toBe(0);
  });

  it("skips an answer with an out-of-range questionIndex gracefully", async () => {
    const result = await evaluate([
      { questionIndex: 999, answer: 0 },
      { questionIndex: 0, answer: 2 },
    ]);
    // Only 1 valid item should be produced
    expect(result.items).toHaveLength(1);
    expect(result.items[0].questionIndex).toBe(0);
  });

  it("MCQ answer given as wrong type (string instead of number) scores 0", async () => {
    // evaluateAnswer checks typeof userAnswer.answer === 'number'
    const result = await evaluate([{ questionIndex: 0, answer: "const" }]);
    expect(result.items[0].score).toBe(0);
    expect(result.items[0].correct).toBe(false);
  });

  it("true_false answer given as wrong type (number instead of boolean) scores 0", async () => {
    const result = await evaluate([{ questionIndex: 2, answer: 0 }]);
    expect(result.items[0].score).toBe(0);
    expect(result.items[0].correct).toBe(false);
  });

  it("summary string mentions the score percentage and item count", async () => {
    const result = await evaluate([
      { questionIndex: 0, answer: 2 },
      { questionIndex: 1, answer: 1 },
    ]);
    expect(result.summary).toContain("100");
    expect(result.summary).toContain("2");
  });
});
