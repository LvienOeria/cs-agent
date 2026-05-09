import { z } from 'zod';
import 'dotenv/config';

const PROVIDER_IDS = ['deepseek', 'openai', 'claude', 'gemini', 'qwen', 'kimi'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const envSchema = z.object({
  // Multi-LLM config (new)
  LLM_PROVIDER: z.enum(PROVIDER_IDS).default('deepseek'),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),

  // Provider-specific API keys (fallback when LLM_API_KEY not set)
  DEEPSEEK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  KIMI_API_KEY: z.string().optional(),

  // Backwards compat
  DEEPSEEK_BASE_URL: z.string().url().optional(),
  DEEPSEEK_MODEL: z.string().optional(),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const raw = envSchema.parse(process.env);

// Resolve: LLM_API_KEY > provider-specific key > error
const PROVIDER_DEFAULTS: Record<ProviderId, { baseURL: string; model: string }> = {
  deepseek: { baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o' },
  claude: { baseURL: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
  gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
};

function resolveApiKey(): string {
  const generic = raw.LLM_API_KEY;
  if (generic) return generic;

  // Fallback to provider-specific key (e.g. DEEPSEEK_API_KEY)
  const specificKey = raw[`${raw.LLM_PROVIDER.toUpperCase()}_API_KEY` as keyof typeof raw] as
    | string
    | undefined;
  if (specificKey) return specificKey;

  throw new Error(
    `No API key configured. Set LLM_API_KEY or ${raw.LLM_PROVIDER.toUpperCase()}_API_KEY.`
  );
}

function resolveBaseURL(): string {
  return raw.LLM_BASE_URL || PROVIDER_DEFAULTS[raw.LLM_PROVIDER].baseURL;
}

function resolveModel(): string {
  return raw.LLM_MODEL || raw.DEEPSEEK_MODEL || PROVIDER_DEFAULTS[raw.LLM_PROVIDER].model;
}

export function getApiKey(provider: string): string {
  // Check generic key first
  if (raw.LLM_API_KEY) return raw.LLM_API_KEY;
  // Then provider-specific key
  const key = raw[`${provider.toUpperCase()}_API_KEY` as keyof typeof raw] as string | undefined;
  if (key) return key;
  throw new Error(`No API key for provider ${provider}`);
}

export function getBaseURL(provider: string): string {
  return raw.LLM_BASE_URL || PROVIDER_DEFAULTS[provider as ProviderId]?.baseURL || '';
}

export const config = {
  ...raw,
  LLM_API_KEY: resolveApiKey(),
  LLM_BASE_URL: resolveBaseURL(),
  LLM_MODEL: resolveModel(),
} as const;

export type Config = typeof config;
