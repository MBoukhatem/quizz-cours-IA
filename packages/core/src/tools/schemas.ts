import { z } from "zod";

export const McqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string(),
  options: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
});
export type McqQuestion = z.infer<typeof McqQuestionSchema>;

export const TrueFalseQuestionSchema = z.object({
  type: z.literal("true_false"),
  question: z.string(),
  answer: z.boolean(),
  explanation: z.string(),
});
export type TrueFalseQuestion = z.infer<typeof TrueFalseQuestionSchema>;

export const OpenQuestionSchema = z.object({
  type: z.literal("open"),
  question: z.string(),
  expectedAnswer: z.string(),
  rubric: z.string(),
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const QuizQuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  TrueFalseQuestionSchema,
  OpenQuestionSchema,
]);
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  topic: z.string(),
  difficulty: z.enum(["facile", "moyen", "difficile"]),
  questions: z.array(QuizQuestionSchema),
});
export type Quiz = z.infer<typeof QuizSchema>;

export const UserAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  answer: z.union([z.string(), z.number(), z.boolean()]),
});
export type UserAnswer = z.infer<typeof UserAnswerSchema>;

export const QuizSubmissionSchema = z.object({
  quiz: QuizSchema,
  answers: z.array(UserAnswerSchema),
});
export type QuizSubmission = z.infer<typeof QuizSubmissionSchema>;

export const EvaluationItemSchema = z.object({
  questionIndex: z.number().int().min(0),
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  feedback: z.string(),
});
export type EvaluationItem = z.infer<typeof EvaluationItemSchema>;

export const EvaluationResultSchema = z.object({
  items: z.array(EvaluationItemSchema),
  totalScore: z.number().min(0).max(1),
  summary: z.string(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
