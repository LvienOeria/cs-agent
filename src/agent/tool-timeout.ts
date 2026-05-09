import { logger } from '../observability/logger.js';

interface TimeoutOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Wraps an async function with a timeout. Returns structured error on timeout
 * instead of throwing, so the agent loop stays alive.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeoutMs = 30_000, signal: parentSignal } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer);
      throw parentSignal.reason ?? new Error('Parent signal aborted');
    }
    parentSignal.addEventListener('abort', () => {
      clearTimeout(timer);
      controller.abort(parentSignal.reason);
    });
  }

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Execute a tool with timeout protection. Returns a result JSON string
 * suitable for ToolResult.content.
 */
export async function executeWithTimeout(
  toolName: string,
  execute: () => Promise<string>,
  timeoutMs: number = 30_000
): Promise<string> {
  try {
    const result = await withTimeout(async (signal) => {
      const r = await execute();
      return r;
    }, { timeoutMs });

    return result;
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    const isAbort = err instanceof Error && err.name === 'AbortError';

    if (isTimeout || isAbort) {
      logger.warn({ toolName, timeoutMs }, 'Tool execution timed out');
      return JSON.stringify({
        error: true,
        message: `Tool ${toolName} 执行超时（${timeoutMs / 1000}s），请简化查询或稍后重试`,
      });
    }

    throw err;
  }
}
