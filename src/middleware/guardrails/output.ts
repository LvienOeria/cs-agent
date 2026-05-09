import { logger } from '../../observability/logger.js';

const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'CN_ID', regex: /\d{17}[\dXx]/ },
  { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: 'PHONE', regex: /1[3-9]\d{9}/ },
  { name: 'CREDIT_CARD', regex: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/ },
];

interface ScanResult {
  hasPII: boolean;
  findings: string[];
}

export function scanForPII(text: string): ScanResult {
  const findings: string[] = [];
  for (const { name, regex } of PII_PATTERNS) {
    if (regex.test(text)) {
      findings.push(name);
    }
  }
  return { hasPII: findings.length > 0, findings };
}

export function sanitizeToolResult(text: string): string {
  const { hasPII, findings } = scanForPII(text);
  if (hasPII) {
    logger.warn({ findings }, 'PII detected in tool result, masking');
    let sanitized = text;
    for (const { regex } of PII_PATTERNS) {
      sanitized = sanitized.replace(regex, '***');
    }
    return sanitized;
  }
  return text;
}
