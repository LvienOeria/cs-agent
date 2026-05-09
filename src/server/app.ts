import express from 'express';
import { createRouter } from './routes.js';
import { createKbRouter } from './kb-routes.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { inputGuardrail } from '../middleware/guardrails/input.js';
import { registry } from '../observability/metrics.js';
import type { LLMClient } from '../llm/types.js';

export function createApp(client: LLMClient, model: string, provider: string): express.Application {
  const app = express();

  app.use(express.json());

  // Middleware chain for API routes
  const rateLimiter = createRateLimiter();
  app.use('/api', rateLimiter);
  app.use('/api', inputGuardrail);

  // Serve static frontend from public/
  app.use(express.static('public'));

  // API routes
  app.use('/api', createRouter(client, model, provider));
  app.use('/api/kb', createKbRouter());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Prometheus metrics
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return app;
}
