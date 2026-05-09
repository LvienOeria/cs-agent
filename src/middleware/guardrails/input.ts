import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../observability/logger.js';

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|above|prior) (instructions|prompts|directives)/i,
  /forget (all )?(previous|above|prior) (instructions|prompts|directives)/i,
  /you are (now|no longer) (a |an )?/i,
  /system\s*(prompt|message|instruction)\s*[:=]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
];

export function inputGuardrail(req: Request, res: Response, next: NextFunction): void {
  const message: string | undefined = req.body?.message;
  if (!message) { next(); return; }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      logger.warn({ message: message.slice(0, 100) }, 'Prompt injection blocked');
      res.status(400).json({ error: '请求包含不被允许的内容' });
      return;
    }
  }

  next();
}
