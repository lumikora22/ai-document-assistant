export interface TextChunk {
  content: string;
  page: number;
}

export interface ChunkingOptions {
  /** Maximum words per chunk. Roughly 400 words is about 500 tokens. */
  maxWords?: number;
  /** Words shared between consecutive chunks to preserve context. */
  overlapWords?: number;
}

const DEFAULT_MAX_WORDS = 400;
const DEFAULT_OVERLAP_WORDS = 60;

/**
 * Splits the text of each page into overlapping word-based chunks.
 *
 * Chunks never cross page boundaries, which keeps page-level citations
 * accurate. Word counts approximate tokens (about 0.75 words per token),
 * so the defaults target roughly 500 tokens per chunk.
 */
export function chunkPages(pageTexts: string[], options: ChunkingOptions = {}): TextChunk[] {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const overlapWords = options.overlapWords ?? DEFAULT_OVERLAP_WORDS;

  if (maxWords <= 0) {
    throw new Error('maxWords must be a positive number');
  }
  if (overlapWords < 0 || overlapWords >= maxWords) {
    throw new Error('overlapWords must be non-negative and smaller than maxWords');
  }

  const chunks: TextChunk[] = [];

  pageTexts.forEach((pageText, pageIndex) => {
    const words = normalizeWhitespace(pageText).split(' ').filter(Boolean);
    if (words.length === 0) {
      return;
    }

    const step = maxWords - overlapWords;
    for (let start = 0; start < words.length; start += step) {
      const slice = words.slice(start, start + maxWords);
      chunks.push({ content: slice.join(' '), page: pageIndex + 1 });
      if (start + maxWords >= words.length) {
        break;
      }
    }
  });

  return chunks;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
