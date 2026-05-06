import { readFile } from 'node:fs/promises';
import { VectorStore, type Document, type SearchResult } from './vector-store.js';
import { logger } from '../observability/logger.js';

export class KnowledgeBase {
  private store = new VectorStore();

  async load(filePath: string): Promise<void> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      const documents: Document[] = JSON.parse(raw);
      this.store.addAll(documents);
      logger.info({ count: documents.length, source: filePath }, 'Knowledge base loaded');
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to load knowledge base');
      throw err;
    }
  }

  search(query: string, topK: number = 3): SearchResult[] {
    return this.store.search(query, topK);
  }

  get documentCount(): number {
    return this.store.size;
  }
}

export const knowledgeBase = new KnowledgeBase();
