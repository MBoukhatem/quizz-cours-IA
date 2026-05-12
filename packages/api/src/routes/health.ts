import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../env.js';

type ServiceStatus = 'up' | 'down';

async function probe(url: string): Promise<ServiceStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status < 500 ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  services: z.object({
    vllm: z.enum(['up', 'down']),
    embeddings: z.enum(['up', 'down']),
    qdrant: z.enum(['up', 'down']),
  }),
});

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/health',
    schema: {
      response: { 200: HealthResponseSchema },
    },
    handler: async (_req, reply) => {
      const [vllm, embeddings, qdrant] = await Promise.all([
        probe(`${env.VLLM_BASE_URL}/models`),
        probe(`${env.EMBEDDINGS_BASE_URL}/health`),
        probe(`${env.QDRANT_URL}/healthz`),
      ]);

      return reply.send({
        status: 'ok' as const,
        services: { vllm, embeddings, qdrant },
      });
    },
  });
}
