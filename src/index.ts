import { config } from './config.js';
import { logger } from './observability/logger.js';
import { knowledgeBase } from './rag/knowledge-base.js';
import { createApp } from './server/app.js';
import { registerProvider, createClient } from './llm/registry.js';
import { createOpenAICompatProvider } from './llm/providers/openai-compat.js';
import { setRetriever } from './tools/search-kb.js';

// Register LLM providers
registerProvider('deepseek', createOpenAICompatProvider('https://api.deepseek.com/v1'));
registerProvider('openai', createOpenAICompatProvider('https://api.openai.com/v1'));
registerProvider('qwen', createOpenAICompatProvider('https://dashscope.aliyuncs.com/compatible-mode/v1'));
registerProvider('kimi', createOpenAICompatProvider('https://api.moonshot.cn/v1'));
// Note: claude & gemini need non-OpenAI-compat adapters (Phase 2)

async function main(): Promise<void> {
  // Load knowledge base
  try {
    await knowledgeBase.load('data/knowledge-base.json');
    logger.info({ count: knowledgeBase.documentCount }, 'Knowledge base ready');
  } catch (err) {
    logger.fatal({ err }, 'Failed to load knowledge base, exiting');
    process.exit(1);
  }

  // Wire Retriever into tools
  setRetriever(knowledgeBase);

  // Create LLM client
  const llmClient = createClient(config.LLM_PROVIDER, {
    apiKey: config.LLM_API_KEY,
    baseURL: config.LLM_BASE_URL,
  });

  // Start HTTP server
  const app = createApp(llmClient, config.LLM_MODEL);
  app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, provider: config.LLM_PROVIDER, model: config.LLM_MODEL },
      'CS Agent server started'
    );
    logger.info(`Open http://localhost:${config.PORT} to use the chat UI`);
    logger.info(`Health check: http://localhost:${config.PORT}/health`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
