import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger.js';
import { RequestTracker } from '../observability/tracker.js';
import { runAgentLoop } from '../agent/loop.js';
import { setupSSE, sendSSEEvent, closeSSE } from './sse.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { LLMClient } from '../llm/types.js';

const chatRequestSchema = z.object({
  message: z.string().min(1, '消息不能为空').max(2000, '消息过长'),
  history: z
    .array(z.object({}).passthrough())
    .optional()
    .default([]),
});

export function createRouter(client: LLMClient, model: string): Router {
  const router = Router();

  router.post('/chat/stream', async (req: Request, res: Response) => {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '请求参数错误' });
      return;
    }

    const { message, history } = parsed.data;
    const requestId = uuidv4();
    const tracker = new RequestTracker(requestId);

    logger.info({ requestId, messageLength: message.length }, 'New chat request');

    setupSSE(res);

    req.on('close', () => {
      logger.info({ requestId }, 'Client disconnected');
    });

    try {
      for await (const event of runAgentLoop(
        client,
        model,
        message,
        history as unknown as ChatCompletionMessageParam[],
        tracker
      )) {
        sendSSEEvent(res, event);

        if (event.type === 'done' || event.type === 'error') {
          const summary = tracker.summary();
          logger.info(summary, 'Request completed');
          closeSSE(res);
          return;
        }
      }
    } catch (err) {
      logger.error({ requestId, err }, 'Unexpected error in agent loop');
      sendSSEEvent(res, {
        type: 'error',
        message: '服务内部错误，请稍后重试',
      });
      closeSSE(res);
    }
  });

  return router;
}
