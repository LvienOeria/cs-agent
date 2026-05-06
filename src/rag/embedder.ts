/**
 * Simple TF (Term Frequency) embedder for MVP.
 * In production, replace with an embedding API (OpenAI, Cohere, etc.).
 *
 * Tokenization strategy:
 * - Chinese characters (CJK): each character is a separate token (bigram would be better but this works for MVP)
 * - Alphabetic/alphanumeric: grouped as words
 * - Everything else (punctuation, whitespace): discarded
 */

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Match: CJK individual characters OR sequences of letters/digits
  const regex = /[\p{Script=Han}]|[a-zA-Z0-9]+/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const token = match[0].toLowerCase();
    // Keep CJK chars (length 1) and meaningful words (length > 1 for latin)
    if (token.length === 1 && /[\p{Script=Han}]/u.test(token)) {
      tokens.push(token);
    } else if (token.length > 1) {
      tokens.push(token);
    }
  }
  return tokens;
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
