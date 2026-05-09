export interface Chunk {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface Retriever {
  search(query: string, topK: number, tenantId?: string): Promise<SearchResult[]>;
  addDocuments(chunks: Chunk[], tenantId?: string): Promise<void>;
  removeDocument(docId: string, tenantId?: string): Promise<void>;
}
