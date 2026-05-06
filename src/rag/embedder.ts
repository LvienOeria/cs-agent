/**
 * Simple TF (Term Frequency) embedder for MVP.
 * In production, replace with an embedding API (OpenAI, Cohere, etc.).
 */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 1);
}

export function buildTFVector(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const total = tokens.length || 1;
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1 / total);
  }
  return tf;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valA] of a) {
    const valB = b.get(key) || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
  }
  for (const valB of b.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function computeSimilarity(query: string, document: string): number {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);
  const queryVec = buildTFVector(queryTokens);
  const docVec = buildTFVector(docTokens);
  return cosineSimilarity(queryVec, docVec);
}
