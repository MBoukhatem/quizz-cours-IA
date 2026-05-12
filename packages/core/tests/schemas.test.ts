import { describe, it, expect } from "vitest";
import {
  QuizSchema,
  QuizSubmissionSchema,
  EvaluationResultSchema,
  McqQuestionSchema,
} from "../src/tools/schemas.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validMcqQuestion = {
  type: "mcq" as const,
  question: "Quel mot-clé déclare une constante en JavaScript ?",
  options: ["var", "let", "const", "def"],
  answerIndex: 2,
  explanation: "const déclare une liaison immuable.",
};

const validTrueFalseQuestion = {
  type: "true_false" as const,
  question: "Python est un langage compilé.",
  answer: false,
  explanation: "Python est interprété, pas compilé.",
};

const validOpenQuestion = {
  type: "open" as const,
  question: "Expliquez le principe de l'encapsulation en POO.",
  expectedAnswer:
    "L'encapsulation consiste à regrouper les données et méthodes dans une classe et à en restreindre l'accès.",
  rubric: "Mention de l'accès restreint ET du regroupement données/méthodes.",
};

const validQuiz = {
  topic: "Programmation",
  difficulty: "moyen" as const,
  questions: [validMcqQuestion, validTrueFalseQuestion, validOpenQuestion],
};

const validSubmission = {
  quiz: validQuiz,
  answers: [
    { questionIndex: 0, answer: 2 },
    { questionIndex: 1, answer: false },
    { questionIndex: 2, answer: "L'encapsulation regroupe données et méthodes." },
  ],
};

const validEvaluationResult = {
  items: [
    { questionIndex: 0, correct: true, score: 1, feedback: "Bonne réponse." },
    { questionIndex: 1, correct: false, score: 0, feedback: "Python est interprété." },
  ],
  totalScore: 0.5,
  summary: "Score total : 50/100 sur 2 question(s) évaluée(s).",
};

// ---------------------------------------------------------------------------
// QuizSchema
// ---------------------------------------------------------------------------

describe("QuizSchema", () => {
  it("accepts a valid quiz with all three question types", () => {
    const result = QuizSchema.safeParse(validQuiz);
    expect(result.success).toBe(true);
  });

  it("accepts difficulty 'facile'", () => {
    const quiz = { ...validQuiz, difficulty: "facile" };
    expect(QuizSchema.safeParse(quiz).success).toBe(true);
  });

  it("accepts difficulty 'difficile'", () => {
    const quiz = { ...validQuiz, difficulty: "difficile" };
    expect(QuizSchema.safeParse(quiz).success).toBe(true);
  });

  it("rejects an unknown difficulty", () => {
    const quiz = { ...validQuiz, difficulty: "expert" };
    expect(QuizSchema.safeParse(quiz).success).toBe(false);
  });

  it("rejects a quiz with no topic", () => {
    const { topic: _omitted, ...rest } = validQuiz;
    expect(QuizSchema.safeParse(rest).success).toBe(false);
  });

  it("round-trips through parse without data loss for mcq question", () => {
    const parsed = QuizSchema.parse(validQuiz);
    const q = parsed.questions[0] as typeof validMcqQuestion;
    expect(q.type).toBe("mcq");
    expect(q.answerIndex).toBe(2);
    expect(q.options).toHaveLength(4);
  });

  it("round-trips through parse without data loss for true_false question", () => {
    const parsed = QuizSchema.parse(validQuiz);
    const q = parsed.questions[1] as typeof validTrueFalseQuestion;
    expect(q.type).toBe("true_false");
    expect(q.answer).toBe(false);
  });

  it("round-trips through parse without data loss for open question", () => {
    const parsed = QuizSchema.parse(validQuiz);
    const q = parsed.questions[2] as typeof validOpenQuestion;
    expect(q.type).toBe("open");
    expect(q.rubric).toBe(validOpenQuestion.rubric);
  });
});

// ---------------------------------------------------------------------------
// McqQuestionSchema — specific structural constraints
// ---------------------------------------------------------------------------

describe("McqQuestionSchema — structural constraints", () => {
  it("rejects an MCQ with only 3 options (minimum is 4)", () => {
    const bad = {
      ...validMcqQuestion,
      options: ["var", "let", "const"],
    };
    expect(McqQuestionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an MCQ with 5 options (maximum is 4)", () => {
    const bad = {
      ...validMcqQuestion,
      options: ["a", "b", "c", "d", "e"],
    };
    expect(McqQuestionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an answerIndex out of range (>3)", () => {
    const bad = { ...validMcqQuestion, answerIndex: 4 };
    expect(McqQuestionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a negative answerIndex", () => {
    const bad = { ...validMcqQuestion, answerIndex: -1 };
    expect(McqQuestionSchema.safeParse(bad).success).toBe(false);
  });

  it("discriminated union rejects type=mcq without answerIndex", () => {
    const bad = {
      type: "mcq",
      question: "Une question ?",
      options: ["a", "b", "c", "d"],
      explanation: "Explication.",
      // answerIndex deliberately omitted
    };
    const result = QuizSchema.safeParse({
      topic: "Test",
      difficulty: "facile",
      questions: [bad],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QuizSubmissionSchema
// ---------------------------------------------------------------------------

describe("QuizSubmissionSchema", () => {
  it("accepts a valid submission with mixed answer types", () => {
    expect(QuizSubmissionSchema.safeParse(validSubmission).success).toBe(true);
  });

  it("rejects a submission missing the quiz field", () => {
    const { quiz: _omitted, ...rest } = validSubmission;
    expect(QuizSubmissionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a negative questionIndex", () => {
    const bad = {
      ...validSubmission,
      answers: [{ questionIndex: -1, answer: 0 }],
    };
    expect(QuizSubmissionSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EvaluationResultSchema
// ---------------------------------------------------------------------------

describe("EvaluationResultSchema", () => {
  it("accepts a valid evaluation result", () => {
    expect(EvaluationResultSchema.safeParse(validEvaluationResult).success).toBe(true);
  });

  it("rejects a totalScore above 1", () => {
    const bad = { ...validEvaluationResult, totalScore: 1.1 };
    expect(EvaluationResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a totalScore below 0", () => {
    const bad = { ...validEvaluationResult, totalScore: -0.1 };
    expect(EvaluationResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an item score above 1", () => {
    const bad = {
      ...validEvaluationResult,
      items: [{ questionIndex: 0, correct: true, score: 2, feedback: "ok" }],
    };
    expect(EvaluationResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing summary", () => {
    const { summary: _omitted, ...rest } = validEvaluationResult;
    expect(EvaluationResultSchema.safeParse(rest).success).toBe(false);
  });
});
