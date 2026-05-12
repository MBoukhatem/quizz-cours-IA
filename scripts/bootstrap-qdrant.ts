import { pino } from 'pino';
import { QdrantStore } from '../packages/core/src/rag/index.js';

async function main(): Promise<void> {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

  const dim = Number(process.env.EMBEDDINGS_DIM ?? 1024);
  const url = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const collection = process.env.QDRANT_COLLECTION ?? 'quiz_cours';

  const store = new QdrantStore({ url, collection });

  logger.info({ url, collection, dim }, 'bootstrapping qdrant collection');
  await store.ensureCollection(dim);
  logger.info({ collection }, 'collection ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
