import type { Request, Response, NextFunction } from 'express';
import { logger } from '../observability/logger.js';
import { rateLimitHits } from '../observability/metrics.js';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  /** Tokens per second refill rate (default 2 = 120 req/min) */
  rate?: number;
  /** Max burst capacity (default 10) */
  burst?: number;
  /** Requester identification — reads x-tenant-id by default */
  keyFn?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const { rate = 2, burst = 10 } = options;
  const keyFn = options.keyFn ?? ((req: Request) => {
    return (req.headers['x-tenant-id'] as string) ?? '_anonymous';
  });

  const buckets = new Map<string, Bucket>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = keyFn(req);

    let bucket = buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = { tokens: burst, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(burst, bucket.tokens + elapsed * rate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      rateLimitHits.inc({ tenant_id: key });
      res.set('Retry-After', '1');
      res.set('X-RateLimit-Limit', String(burst));
      res.status(429).json({ error: '请求过于频繁，请稍后重试' });
      return;
    }

    bucket.tokens -= 1;
    next();
  };
}
