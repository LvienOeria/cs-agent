import { config, getApiKey, getBaseURL } from './config.js';
import { logger } from './observability/logger.js';
import { knowledgeBase } from './rag/knowledge-base.js';
import { createApp } from './server/app.js';
import { registerProvider, createClient } from './llm/registry.js';
import { createOpenAICompatProvider } from './llm/providers/openai-compat.js';
import { createAnthropicProvider } from './llm/providers/anthropic.js';
import { createGeminiProvider } from './llm/providers/google.js';
import { setRetriever } from './tools/search-kb.js';
import { createCircuitBreaker } from './agent/circuit-breaker.js';
import { createFallbackChain } from './agent/circuit-breaker.js';

// Register all 6 LLM providers
registerProvider('deepseek', createOpenAICompatProvider('https://api.deepseek.com/v1'));
registerProvider('openai', createOpenAICompatProvider('https://api.openai.com/v1'));
registerProvider('qwen', createOpenAICompatProvider('https://dashscope.aliyuncs.com/compatible-mode/v1'));
registerProvider('kimi', createOpenAICompatProvider('https://api.moonshot.cn/v1'));
registerProvider('claude', createAnthropicProvider());
registerProvider('gemini', createGeminiProvider());

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

  // Build fallback chain: each provider wrapped in circuit breaker
  // Providers without API keys are silently skipped
  const providers: Array<{ name: string; client: ReturnType<typeof createCircuitBreaker> }> = [];

  for (const name of ['deepseek', 'openai', 'claude', 'gemini', 'qwen', 'kimi']) {
    try {
      const client = createCircuitBreaker(
        createClient(name, {
          apiKey: getApiKey(name),
          baseURL: getBaseURL(name),
        })
      );
      providers.push({ name, client });
    } catch {
      // Provider not configured — skip
    }
  }

  // Ensure primary provider is first in chain
  const primaryIdx = providers.findIndex((p) => p.name === config.LLM_PROVIDER);
  if (primaryIdx > 0) {
    const primary = providers.splice(primaryIdx, 1)[0]!;
    providers.unshift(primary);
  }
  if (providers.length === 0) {
    throw new Error('No LLM provider configured');
  }

  const llmClient =
    providers.length > 1
      ? createFallbackChain(providers)
      : providers[0]!.client;

  logger.info(
    { providers: providers.map((p) => p.name) },
    `LLM chain ready (${providers.length} provider${providers.length > 1 ? 's' : ''})`
  );

  // Start HTTP server
  const app = createApp(llmClient, config.LLM_MODEL, config.LLM_PROVIDER);
  app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, provider: config.LLM_PROVIDER, model: config.LLM_MODEL },
      'CS Agent server started'
    );
    logger.info(`Open http://localhost:${config.PORT} to use the chat UI`);
    logger.info(`Health check: http://localhost:${config.PORT}/health`);
    logger.info(`Metrics: http://localhost:${config.PORT}/metrics`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
