import { QdrantStore } from '@quizz/core';
import { env } from './env.js';
import { buildApp } from './app.js';
import { logger } from './logger.js';

const dim = Number(process.env.EMBEDDINGS_DIM ?? 1024);
try {
  await new QdrantStore().ensureCollection(dim);
  logger.info({ dim }, 'qdrant collection ready');
} catch (err) {
  logger.error({ err }, 'failed to ensure qdrant collection at startup');
  process.exit(1);
}

const app = await buildApp();

const closeGracefully = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'shutdown signal received, closing server');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void closeGracefully('SIGTERM'));
process.on('SIGINT', () => void closeGracefully('SIGINT'));

await app.listen({ host: env.API_HOST, port: env.API_PORT });
