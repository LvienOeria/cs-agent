import { readFile } from 'node:fs/promises';
import { VectorStore } from './vector-store.js';
import { logger } from '../observability/logger.js';
import type { Chunk, SearchResult, Retriever } from './types.js';

export class KnowledgeBase implements Retriever {
  private store = new VectorStore();

  async load(filePath: string): Promise<void> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      const documents: { id: string; content: string; metadata?: Record<string, string> }[] =
        JSON.parse(raw);
      const chunks: Chunk[] = documents.map((doc) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      }));
      this.store.addAll(chunks);
      logger.info({ count: chunks.length, source: filePath }, 'Knowledge base loaded');
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to load knowledge base');
      throw err;
    }
  }

  async search(query: string, topK: number = 3, tenantId?: string): Promise<SearchResult[]> {
    return this.store.search(query, topK, tenantId);
  }

  async addDocuments(chunks: Chunk[], tenantId?: string): Promise<void> {
    this.store.addAll(chunks, tenantId);
    logger.info({ count: chunks.length, tenantId }, 'Documents added to knowledge base');
  }

  async removeDocument(docId: string, tenantId?: string): Promise<void> {
    const removed = this.store.removeByDocumentId(docId, tenantId);
    logger.info({ docId, tenantId, removedChunks: removed }, 'Document removed from knowledge base');
  }

  get documentCount(): number {
    return this.store.size;
  }
}

export const knowledgeBase = new KnowledgeBase();
