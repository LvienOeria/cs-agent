import { tokenize, buildTFVector, cosineSimilarity } from './embedder.js';

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface SearchResult {
  document: Document;
  score: number;
}

interface IndexedDocument {
  document: Document;
  vector: Map<string, number>;
}

export class VectorStore {
  private documents: IndexedDocument[] = [];

  add(document: Document): void {
    const tokens = tokenize(document.content);
    const vector = buildTFVector(tokens);
    this.documents.push({ document, vector });
  }

  addAll(documents: Document[]): void {
    for (const doc of documents) {
      this.add(doc);
    }
  }

  search(query: string, topK: number = 5): SearchResult[] {
    const queryTokens = tokenize(query);
    const queryVector = buildTFVector(queryTokens);

    const scored: SearchResult[] = this.documents.map(({ document, vector }) => ({
      document,
      score: cosineSimilarity(queryVector, vector),
    }));

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  get size(): number {
    return this.documents.length;
  }
}
