import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  QuizSubmissionSchema,
  EvaluationResultSchema,
  EvaluationItem,
  type QuizQuestion,
  type UserAnswer,
} from "./schemas.js";

const openScoreSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string(),
});

async function evaluateOpenQuestion(
  model: ChatOpenAI,
  question: Extract<QuizQuestion, { type: "open" }>,
  userAnswer: string
): Promise<{ score: number; feedback: string }> {
  const structured = model.withStructuredOutput(openScoreSchema, {
    name: "OpenQuestionScore",
  });

  const system = new SystemMessage(
    `Tu es un correcteur pédagogique bienveillant. Tu évalues des réponses ouvertes en français.\n` +
      `Tu attribues un score entre 0 et 1 (avec 0.5 pour une réponse partiellement correcte).\n` +
      `Le feedback doit être en français, constructif et référencer le critère d'évaluation.`
  );

  const user = new HumanMessage(
    `Question : ${question.question}\n\n` +
      `Réponse attendue : ${question.expectedAnswer}\n\n` +
      `Critères d'évaluation : ${question.rubric}\n\n` +
      `Réponse de l'étudiant : ${userAnswer}\n\n` +
      `Évalue la réponse et fournis un score (0 à 1) et un feedback en français.`
  );

  return structured.invoke([system, user]);
}

function evaluateAnswer(
  question: QuizQuestion,
  userAnswer: UserAnswer
): { correct: boolean; score: number; feedback: string } | null {
  if (question.type === "mcq") {
    const correct =
      typeof userAnswer.answer === "number" &&
      userAnswer.answer === question.answerIndex;
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: question.explanation,
    };
  }

  if (question.type === "true_false") {
    const correct =
      typeof userAnswer.answer === "boolean" &&
      userAnswer.answer === question.answer;
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: question.explanation,
    };
  }

  return null;
}

export function makeQuizEvaluatorTool(model: ChatOpenAI) {
  return tool(
    async (submission) => {
      const { quiz, answers } = submission;
      const items: EvaluationItem[] = [];

      for (const userAnswer of answers) {
        const { questionIndex } = userAnswer;
        const question = quiz.questions[questionIndex];

        if (question === undefined) {
          continue;
        }

        if (question.type === "open") {
          const answerText =
            typeof userAnswer.answer === "string"
              ? userAnswer.answer
              : String(userAnswer.answer);
          const { score, feedback } = await evaluateOpenQuestion(
            model,
            question,
            answerText
          );
          items.push({
            questionIndex,
            correct: score >= 0.5,
            score,
            feedback,
          });
        } else {
          const result = evaluateAnswer(question, userAnswer);
          if (result !== null) {
            items.push({ questionIndex, ...result });
          }
        }
      }

      const totalScore =
        items.length > 0
          ? items.reduce((sum, item) => sum + item.score, 0) / items.length
          : 0;

      const scorePercent = Math.round(totalScore * 100);
      const summary = `Score total : ${scorePercent}/100 sur ${items.length} question(s) évaluée(s).`;

      const result: z.infer<typeof EvaluationResultSchema> = {
        items,
        totalScore,
        summary,
      };

      return result;
    },
    {
      name: "quiz_evaluator",
      description:
        "Evaluate a submitted quiz by comparing student answers against correct answers. MCQ and true/false are scored deterministically; open questions are scored by the LLM. Returns scores and French feedback per question plus a total score.",
      schema: QuizSubmissionSchema,
    }
  );
}
