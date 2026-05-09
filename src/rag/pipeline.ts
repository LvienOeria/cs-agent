import { v4 as uuidv4 } from 'uuid';
import { parseFile } from './parser/index.js';
import { chunkText } from './chunker.js';
import { knowledgeBase } from './knowledge-base.js';
import { logger } from '../observability/logger.js';
import type { Chunk } from './types.js';

interface IngestOptions {
  tenantId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export async function ingestFile(
  filePath: string,
  mimeType: string | undefined,
  options: IngestOptions = {}
): Promise<Chunk[]> {
  const text = await parseFile(filePath, mimeType);
  const textChunks = chunkText(text, {
    size: options.chunkSize,
    overlap: options.chunkOverlap,
  });

  const docId = uuidv4();
  const chunks: Chunk[] = textChunks.map((content, i) => ({
    id: `${docId}-chunk-${i}`,
    content,
    metadata: {
      documentId: docId,
      sourceFile: filePath,
      chunkIndex: String(i),
      totalChunks: String(textChunks.length),
    },
  }));

  await knowledgeBase.addDocuments(chunks, options.tenantId);
  logger.info(
    { filePath, docId, chunks: chunks.length, tenantId: options.tenantId },
    'File ingested into knowledge base'
  );

  return chunks;
}
