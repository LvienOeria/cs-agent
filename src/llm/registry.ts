import type { LLMClient, LLMProviderFactory } from './types.js';

const factories = new Map<string, LLMProviderFactory>();

export function registerProvider(name: string, factory: LLMProviderFactory): void {
  factories.set(name, factory);
}

export function createClient(name: string, config: Record<string, string>): LLMClient {
  const factory = factories.get(name);
  if (!factory) {
    throw new Error(`Unknown LLM provider: ${name}. Available: ${[...factories.keys()].join(', ')}`);
  }
  return factory(config);
}

export function getAvailableProviders(): string[] {
  return [...factories.keys()];
}
