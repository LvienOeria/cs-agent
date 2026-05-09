import { logger } from '../observability/logger.js';
import { providerFallbackTotal } from '../observability/metrics.js';
import type { LLMClient, CompletionRequest, CompletionResponse, StreamingChunk } from '../llm/types.js';

enum State {
  Closed,
  Open,
  HalfOpen,
}

interface BreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Circuit breaker that wraps an LLMClient. Tracks consecutive failures;
 * opens the circuit when threshold is reached, then probes after timeout.
 */
export function createCircuitBreaker(
  client: LLMClient,
  options: BreakerOptions = {}
): LLMClient {
  const { failureThreshold = 3, recoveryTimeoutMs = 30_000 } = options;

  let state = State.Closed;
  let failures = 0;
  let lastFailureTime = 0;

  function recordSuccess(): void {
    state = State.Closed;
    failures = 0;
  }

  function recordFailure(): void {
    failures++;
    lastFailureTime = Date.now();
    if (failures >= failureThreshold && state !== State.Open) {
      state = State.Open;
      options.onOpen?.();
      logger.error({ failures }, 'Circuit breaker opened');
    }
  }

  function allowRequest(): boolean {
    if (state === State.Closed) return true;
    if (state === State.Open) {
      if (Date.now() - lastFailureTime >= recoveryTimeoutMs) {
        state = State.HalfOpen;
        logger.info('Circuit breaker half-open — probing');
        return true;
      }
      return false;
    }
    // HalfOpen: allow one probe
    return true;
  }

  async function complete(req: CompletionRequest): Promise<CompletionResponse> {
    if (!allowRequest()) {
      throw new CircuitOpenError();
    }
    try {
      const resp = await client.complete(req);
      recordSuccess();
      return resp;
    } catch (err) {
      recordFailure();
      throw err;
    }
  }

  async function* completeStream(req: CompletionRequest): AsyncGenerator<StreamingChunk> {
    if (!allowRequest()) {
      throw new CircuitOpenError();
    }
    try {
      for await (const chunk of client.completeStream(req)) {
        yield chunk;
      }
      recordSuccess();
    } catch (err) {
      recordFailure();
      throw err;
    }
  }

  return { complete, completeStream };
}

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open');
    this.name = 'CircuitOpenError';
  }
}

/**
 * Provider fallback chain. Tries providers in order; on CircuitOpenError or
 * other failure, moves to the next. Throws FallbackExhaustedError if all fail.
 */
export function createFallbackChain(
  providers: Array<{ name: string; client: LLMClient }>
): LLMClient {
  async function complete(req: CompletionRequest): Promise<CompletionResponse> {
    for (let i = 0; i < providers.length; i++) {
      const { name, client } = providers[i];
      try {
        return await client.complete(req);
      } catch (err) {
        if (i < providers.length - 1) {
          const next = providers[i + 1];
          providerFallbackTotal.inc({ from_provider: name, to_provider: next.name });
          logger.warn({ from: name, to: next.name, err }, 'Provider fallback');
        }
      }
    }
    throw new FallbackExhaustedError(providers.map((p) => p.name));
  }

  async function* completeStream(req: CompletionRequest): AsyncGenerator<StreamingChunk> {
    for (let i = 0; i < providers.length; i++) {
      const { name, client } = providers[i];
      try {
        for await (const chunk of client.completeStream(req)) {
          yield chunk;
        }
        return;
      } catch (err) {
        if (i < providers.length - 1) {
          const next = providers[i + 1];
          providerFallbackTotal.inc({ from_provider: name, to_provider: next.name });
          logger.warn({ from: name, to: next.name, err }, 'Provider fallback');
        }
      }
    }
    throw new FallbackExhaustedError(providers.map((p) => p.name));
  }

  return { complete, completeStream };
}

export class FallbackExhaustedError extends Error {
  constructor(providers: string[]) {
    super(`All providers exhausted: ${providers.join(', ')}`);
    this.name = 'FallbackExhaustedError';
  }
}
