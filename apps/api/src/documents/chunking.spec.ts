import { chunkPages } from './chunking';

function makeWords(count: number, prefix = 'word'): string {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('chunkPages', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages(['', '   ', '\n\t'])).toEqual([]);
  });

  it('keeps a short page as a single chunk', () => {
    const chunks = chunkPages(['A short page of text.']);
    expect(chunks).toEqual([{ content: 'A short page of text.', page: 1 }]);
  });

  it('splits long pages into chunks capped at maxWords', () => {
    const chunks = chunkPages([makeWords(1000)], { maxWords: 400, overlapWords: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.split(' ').length).toBeLessThanOrEqual(400);
    }
  });

  it('overlaps consecutive chunks by the configured word count', () => {
    const chunks = chunkPages([makeWords(150)], { maxWords: 100, overlapWords: 20 });
    const first = chunks[0].content.split(' ');
    const second = chunks[1].content.split(' ');
    expect(second.slice(0, 20)).toEqual(first.slice(80, 100));
  });

  it('does not lose any words when chunking', () => {
    const totalWords = 950;
    const chunks = chunkPages([makeWords(totalWords)], { maxWords: 300, overlapWords: 50 });
    const seen = new Set<string>();
    for (const chunk of chunks) {
      for (const word of chunk.content.split(' ')) {
        seen.add(word);
      }
    }
    expect(seen.size).toBe(totalWords);
  });

  it('never crosses page boundaries and tracks 1-based page numbers', () => {
    const chunks = chunkPages([makeWords(50, 'a'), makeWords(250, 'b')], {
      maxWords: 100,
      overlapWords: 10,
    });
    const pageOne = chunks.filter((c) => c.page === 1);
    const pageTwo = chunks.filter((c) => c.page === 2);
    expect(pageOne).toHaveLength(1);
    expect(pageTwo.length).toBeGreaterThan(1);
    expect(pageOne[0].content).not.toContain('b0');
    for (const chunk of pageTwo) {
      expect(chunk.content).not.toContain('a0');
    }
  });

  it('normalizes runs of whitespace inside a page', () => {
    const chunks = chunkPages(['hello\n\n  world\ttabs']);
    expect(chunks[0].content).toBe('hello world tabs');
  });

  it('rejects invalid options', () => {
    expect(() => chunkPages(['text'], { maxWords: 0 })).toThrow();
    expect(() => chunkPages(['text'], { maxWords: 10, overlapWords: 10 })).toThrow();
  });
});
