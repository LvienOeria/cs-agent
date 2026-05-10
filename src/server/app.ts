import express from 'express';
import helmet from 'helmet';
import { createRouter } from './routes.js';
import { createKbRouter } from './kb-routes.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { inputGuardrail } from '../middleware/guardrails/input.js';
import { registry } from '../observability/metrics.js';
import type { LLMClient } from '../llm/types.js';

export function createApp(client: LLMClient, model: string, provider: string): express.Application {
  const app = express();

  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    })
  );
  app.use(express.json());

  // Middleware chain for API routes
  const rateLimiter = createRateLimiter();
  app.use('/api', rateLimiter);
  app.use('/api', inputGuardrail);

  // Serve React frontend
  app.use(express.static('frontend/dist'));

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
