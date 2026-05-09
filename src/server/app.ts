import express from 'express';
import { createRouter } from './routes.js';
import { createKbRouter } from './kb-routes.js';
import type { LLMClient } from '../llm/types.js';

export function createApp(client: LLMClient, model: string): express.Application {
  const app = express();

  app.use(express.json());

  // Serve static frontend from public/
  app.use(express.static('public'));

  // API routes
  app.use('/api', createRouter(client, model));
  app.use('/api/kb', createKbRouter());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
