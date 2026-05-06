import express from 'express';
import { router } from './routes.js';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());

  // Serve static frontend from public/
  app.use(express.static('public'));

  // API routes
  app.use('/api', router);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
