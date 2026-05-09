import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_ms',
  help: 'LLM API request duration in ms',
  labelNames: ['provider', 'model'],
  registers: [registry],
  buckets: [200, 500, 1000, 2000, 5000, 10000, 20000],
});

export const llmTokenUsage = new Counter({
  name: 'llm_token_usage_total',
  help: 'Total LLM token consumption',
  labelNames: ['provider', 'model', 'type'],
  registers: [registry],
});

export const toolExecutionDuration = new Histogram({
  name: 'tool_execution_duration_ms',
  help: 'Tool execution duration in ms',
  labelNames: ['tool_name'],
  registers: [registry],
  buckets: [10, 50, 100, 500, 1000, 5000, 30000],
});

export const agentRounds = new Histogram({
  name: 'agent_rounds_total',
  help: 'Number of ReAct rounds per request',
  registers: [registry],
  buckets: [1, 2, 3, 4, 5],
});

export const requestErrors = new Counter({
  name: 'request_errors_total',
  help: 'Total request errors',
  labelNames: ['type'],
  registers: [registry],
});

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit exceeded responses',
  labelNames: ['tenant_id'],
  registers: [registry],
});

export const providerFallbackTotal = new Counter({
  name: 'provider_fallback_total',
  help: 'Total provider fallback triggers',
  labelNames: ['from_provider', 'to_provider'],
  registers: [registry],
});
