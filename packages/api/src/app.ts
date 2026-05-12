import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { logger } from './logger.js';
import { env } from './env.js';
import { registerZod } from './plugins/zod.js';
import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { chatRoutes } from './routes/chat.js';
import { quizRoutes } from './routes/quiz.js';

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger });

  registerZod(app);

  await app.register(sensible);

  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : '*',
  });

  await app.register(multipart, {
    limits: {
      fileSize: Number.MAX_SAFE_INTEGER,
    },
  });

  await app.register(rateLimit, {
    max: env.API_RATE_LIMIT_MAX,
    timeWindow: env.API_RATE_LIMIT_WINDOW,
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err, url: req.url, method: req.method }, 'unhandled error');
    const statusCode = err.statusCode ?? 500;
    void reply.status(statusCode).send({ error: statusCode < 500 ? err.message : 'internal_error' });
  });

  await app.register(healthRoutes);
  await app.register(ingestRoutes);
  await app.register(chatRoutes);
  await app.register(quizRoutes);

  return app;
}
