import { readFile, writeFile } from 'node:fs/promises';
import { VectorStore } from './vector-store.js';
import { logger } from '../observability/logger.js';
import type { Chunk, SearchResult, Retriever } from './types.js';

export class KnowledgeBase implements Retriever {
  private store = new VectorStore();
  private filePath: string | null = null;

  async load(filePath: string): Promise<void> {
    this.filePath = filePath;
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

  private async persist(): Promise<void> {
    if (!this.filePath) return;
    const chunks = this.store.getAll();
    const documents = chunks.map((c) => ({
      id: c.id,
      content: c.content,
      metadata: c.metadata,
    }));
    await writeFile(this.filePath, JSON.stringify(documents, null, 2), 'utf-8');
    logger.info({ count: documents.length }, 'Knowledge base persisted');
  }

  async search(query: string, topK: number = 3, tenantId?: string): Promise<SearchResult[]> {
    return this.store.search(query, topK, tenantId);
  }

  async addDocuments(chunks: Chunk[], tenantId?: string): Promise<void> {
    this.store.addAll(chunks, tenantId);
    logger.info({ count: chunks.length, tenantId }, 'Documents added to knowledge base');
    await this.persist();
  }

  async removeDocument(docId: string, tenantId?: string): Promise<void> {
    const removed = this.store.removeByDocumentId(docId, tenantId);
    if (removed === 0) {
      logger.warn({ docId, tenantId }, 'Document not found for removal');
      return;
    }
    logger.info({ docId, tenantId, removedChunks: removed }, 'Document removed from knowledge base');
    await this.persist();
  }

  async listDocuments(tenantId?: string): Promise<Chunk[]> {
    return this.store.getAll(tenantId);
  }

  get documentCount(): number {
    return this.store.size;
  }
}

export const knowledgeBase = new KnowledgeBase();
