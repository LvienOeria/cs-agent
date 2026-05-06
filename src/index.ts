import { config } from './config.js';
import { logger } from './observability/logger.js';
import { knowledgeBase } from './rag/knowledge-base.js';
import { createApp } from './server/app.js';

async function main(): Promise<void> {
  // Load knowledge base
  try {
    await knowledgeBase.load('data/knowledge-base.json');
    logger.info({ count: knowledgeBase.documentCount }, 'Knowledge base ready');
  } catch (err) {
    logger.fatal({ err }, 'Failed to load knowledge base, exiting');
    process.exit(1);
  }

  // Start HTTP server
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'CS Agent server started');
    logger.info(`Open http://localhost:${config.PORT} to use the chat UI`);
    logger.info(`Health check: http://localhost:${config.PORT}/health`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
