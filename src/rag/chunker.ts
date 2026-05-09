interface ChunkOptions {
  /** Target chunk size in characters (default 600, roughly 400 tokens for CJK) */
  size?: number;
  /** Overlap ratio between consecutive chunks (default 0.2 = 20%) */
  overlap?: number;
  /** Min chunk size — chunks shorter than this are merged into previous (default size/4) */
  minSize?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const size = options.size ?? 600;
  const overlap = options.overlap ?? 0.2;
  const minSize = options.minSize ?? Math.floor(size / 4);
  const step = Math.floor(size * (1 - overlap));

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Try to break at a natural boundary
    const window = text.slice(start, end);
    const breakPoints = ['\n\n', '\n', '。', '；', '. ', '.', '，', ',', ' ', ' '];
    let splitAt = end;

    for (const sep of breakPoints) {
      const idx = window.lastIndexOf(sep);
      if (idx > minSize) {
        splitAt = start + idx + sep.length;
        break;
      }
    }

    chunks.push(text.slice(start, splitAt));
    start = splitAt;
  }

  // Merge trailing short chunk into previous
  if (chunks.length >= 2 && chunks[chunks.length - 1].length < minSize) {
    const last = chunks.pop()!;
    chunks[chunks.length - 1] += last;
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/** Estimate token count for CJK-mixed text. Rough: 1 CJK char ≈ 0.75 token, 1 word ≈ 1.3 tokens */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let latin = 0;
  for (const ch of text) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) {
      cjk++;
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      latin++;
    }
  }
  return Math.ceil(cjk * 0.75 + (text.length - cjk) * 0.3);
}
