import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  buildGraph,
  runChat,
  makeQuizEvaluatorTool,
  SessionStore,
  createChatModel,
} from '@quizz/core';

const CitationSchema = z.object({
  source: z.string(),
  page: z.number().optional(),
  chunkIndex: z.number(),
  score: z.number(),
});

const WebMcqSchema = z.object({
  id: z.string(),
  type: z.literal('mcq'),
  text: z.string(),
  options: z.array(z.string()),
});
const WebTrueFalseSchema = z.object({
  id: z.string(),
  type: z.literal('true_false'),
  text: z.string(),
});
const WebOpenSchema = z.object({
  id: z.string(),
  type: z.literal('open'),
  text: z.string(),
});
const WebQuestionSchema = z.discriminatedUnion('type', [
  WebMcqSchema,
  WebTrueFalseSchema,
  WebOpenSchema,
]);
const WebQuizSchema = z.object({
  sessionId: z.string(),
  title: z.string(),
  questions: z.array(WebQuestionSchema),
});

const WebSubmissionSchema = z.object({
  sessionId: z.string(),
  threadId: z.string().uuid(),
  answers: z.record(z.string(), z.string()),
});

const WebFeedbackSchema = z.object({
  questionId: z.string(),
  score: z.number().min(0).max(1),
  feedback: z.string(),
  correct: z.boolean(),
});

const WebEvaluationSchema = z.object({
  sessionId: z.string(),
  totalScore: z.number().min(0).max(1),
  feedback: z.array(WebFeedbackSchema),
});

const SessionRowSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  quizJson: z.string(),
  createdAt: z.number(),
  submittedAt: z.number().nullable(),
  answersJson: z.string().nullable(),
  evaluationJson: z.string().nullable(),
  score: z.number().nullable(),
});

const evaluatorModel = createChatModel({ streaming: false });
const evaluatorTool = makeQuizEvaluatorTool(evaluatorModel);
const graph = buildGraph();
const store = new SessionStore();

interface CoreMcq {
  type: 'mcq';
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}
interface CoreTrueFalse {
  type: 'true_false';
  question: string;
  answer: boolean;
  explanation: string;
}
interface CoreOpen {
  type: 'open';
  question: string;
  expectedAnswer: string;
  rubric: string;
}
type CoreQuestion = CoreMcq | CoreTrueFalse | CoreOpen;
interface CoreQuiz {
  topic: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  questions: CoreQuestion[];
}
interface CoreEvaluationItem {
  questionIndex: number;
  correct: boolean;
  score: number;
  feedback: string;
}
interface CoreEvaluationResult {
  items: CoreEvaluationItem[];
  totalScore: number;
  summary: string;
}

function toWebQuiz(sessionId: string, core: CoreQuiz): z.infer<typeof WebQuizSchema> {
  return {
    sessionId,
    title: core.topic,
    questions: core.questions.map((q, i) => {
      const id = `q${i}`;
      if (q.type === 'mcq') {
        return { id, type: 'mcq' as const, text: q.question, options: q.options };
      }
      if (q.type === 'true_false') {
        return { id, type: 'true_false' as const, text: q.question };
      }
      return { id, type: 'open' as const, text: q.question };
    }),
  };
}

export async function quizRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'POST',
    url: '/quiz',
    schema: {
      body: z.object({
        threadId: z.string().uuid(),
        source: z.string().min(1),
        numQuestions: z.number().int().min(1).max(20).default(5),
      }),
      response: {
        200: z.object({
          quiz: WebQuizSchema,
          citations: z.array(CitationSchema),
        }),
        422: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { threadId, source, numQuestions } = req.body;

      const gen = runChat(graph, {
        threadId,
        userMessage: `Génère un quiz de ${numQuestions} questions sur le document.`,
        sourceFilter: source,
        numQuestions,
      });

      let coreQuiz: CoreQuiz | undefined;
      let citations: z.infer<typeof CitationSchema>[] = [];
      for await (const event of gen) {
        if (event.type === 'final.done') {
          coreQuiz = event.payload.quiz as CoreQuiz | undefined;
          citations = (event.payload.citations ?? []) as z.infer<typeof CitationSchema>[];
          break;
        }
      }

      if (!coreQuiz) {
        return reply.code(422).send({ error: 'Quiz generation failed' });
      }

      const sessionId = store.createSession({ threadId, quiz: coreQuiz });
      const webQuiz = toWebQuiz(sessionId, coreQuiz);
      return reply.send({ quiz: webQuiz, citations });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'POST',
    url: '/quiz/submit',
    schema: {
      body: WebSubmissionSchema,
      response: {
        200: WebEvaluationSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { sessionId, answers } = req.body;

      const session = store.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({ error: 'session_not_found' });
      }

      const coreQuiz = JSON.parse(session.quizJson) as CoreQuiz;
      const coreAnswers = coreQuiz.questions.map((q, i) => {
        const raw = answers[`q${i}`] ?? '';
        if (q.type === 'mcq') {
          const idx = q.options.indexOf(raw);
          return { questionIndex: i, answer: idx >= 0 ? idx : 0 };
        }
        if (q.type === 'true_false') {
          return { questionIndex: i, answer: raw === 'true' };
        }
        return { questionIndex: i, answer: raw };
      });

      const result = (await evaluatorTool.invoke({
        quiz: coreQuiz,
        answers: coreAnswers,
      })) as CoreEvaluationResult;

      store.submitAnswers({
        sessionId,
        answers: coreAnswers,
        evaluation: result,
        score: result.totalScore,
      });

      return reply.send({
        sessionId,
        totalScore: result.totalScore,
        feedback: result.items.map((it) => ({
          questionId: `q${it.questionIndex}`,
          score: it.score,
          feedback: it.feedback,
          correct: it.correct,
        })),
      });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/quiz/sessions',
    schema: {
      querystring: z.object({
        threadId: z.string().uuid(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      response: {
        200: z.object({ sessions: z.array(SessionRowSchema) }),
      },
    },
    handler: async (req, reply) => {
      const { threadId, limit } = req.query;
      const sessions = store.listByThread(threadId, limit);
      return reply.send({ sessions });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/quiz/sessions/:id',
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: SessionRowSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const session = store.getSession(req.params.id);
      if (!session) return reply.code(404).send({ error: 'session_not_found' });
      return reply.send(session);
    },
  });
}
