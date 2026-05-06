import type { Response } from 'express';
import type { AgentStreamEvent } from '../agent/types.js';

export function setupSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function sendSSEEvent(res: Response, event: AgentStreamEvent): void {
  const data = JSON.stringify(event);
  res.write(`event: ${event.type}\ndata: ${data}\n\n`);
}

export function sendSSEError(res: Response, message: string): void {
  const data = JSON.stringify({ type: 'error', message });
  res.write(`event: error\ndata: ${data}\n\n`);
}

export function closeSSE(res: Response): void {
  res.write('event: close\ndata: {}\n\n');
  res.end();
}
