import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { buildGraph, runChat } from '@quizz/core';
import type { GraphEvent } from '@quizz/core';
import { detectInjection } from '../security/prompt_guard.js';

const graph = buildGraph();

const ChatBodySchema = z.object({
  threadId: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

function formatSseEvent(event: GraphEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'POST',
    url: '/chat',
    schema: {
      body: ChatBodySchema,
    },
    handler: async (req, reply) => {
      const { threadId, message } = req.body;

      const guard = detectInjection(message);
      if (guard.suspicious) {
        req.log.warn({ threadId, reason: guard.reason }, 'prompt injection detected');
        return reply.status(400).send({
          error: 'prompt_injection_detected',
          reason: guard.reason,
        });
      }

      reply.hijack();

      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      raw.flushHeaders?.();

      const controller = new AbortController();

      raw.on('close', () => {
        controller.abort();
      });

      try {
        const gen = runChat(graph, { threadId, userMessage: message });

        for await (const event of gen) {
          if (controller.signal.aborted) break;
          raw.write(formatSseEvent(event));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          req.log.error({ err, threadId }, 'chat stream error');
          raw.write(`event: error\ndata: ${JSON.stringify({ error: 'stream_error' })}\n\n`);
        }
      } finally {
        raw.end();
      }
    },
  });
}
