import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { logger } from '../../observability/logger.js';

function guessExt(filePath: string, mimeType?: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/x-markdown': '.md',
  };
  if (mimeType && mimeMap[mimeType]) return mimeMap[mimeType];
  return extname(filePath).toLowerCase();
}

export async function parseFile(filePath: string, mimeType?: string): Promise<string> {
  const ext = guessExt(filePath, mimeType);
  const buffer = await readFile(filePath);

  switch (ext) {
    case '.pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
    case '.docx': {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ buffer });
      return result.value;
    }
    case '.md':
    case '.txt':
    case '.text':
      return buffer.toString('utf-8');
    default:
      logger.warn({ ext, filePath }, 'Unknown file type, treating as UTF-8 text');
      return buffer.toString('utf-8');
  }
}
