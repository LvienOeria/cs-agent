import { tokenize, buildTFVector, cosineSimilarity } from './embedder.js';
import type { Chunk, SearchResult } from './types.js';

interface IndexedChunk {
  chunk: Chunk;
  vector: Map<string, number>;
  tenantId?: string;
}

export class VectorStore {
  private entries: IndexedChunk[] = [];

  add(chunk: Chunk, tenantId?: string): void {
    const tokens = tokenize(chunk.content);
    const vector = buildTFVector(tokens);
    this.entries.push({ chunk, vector, tenantId });
  }

  addAll(chunks: Chunk[], tenantId?: string): void {
    for (const chunk of chunks) {
      this.add(chunk, tenantId);
    }
  }

  search(query: string, topK: number = 5, tenantId?: string): SearchResult[] {
    const queryTokens = tokenize(query);
    const queryVector = buildTFVector(queryTokens);

    const scored: { chunk: Chunk; score: number }[] = this.entries
      .filter((e) => !tenantId || e.tenantId === tenantId)
      .map(({ chunk, vector }) => ({
        chunk,
        score: cosineSimilarity(queryVector, vector),
      }));

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  removeByDocumentId(docId: string, tenantId?: string): number {
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (e) => !(e.chunk.metadata?.documentId === docId && (!tenantId || e.tenantId === tenantId))
    );
    return before - this.entries.length;
  }

  get size(): number {
    return this.entries.length;
  }
}
