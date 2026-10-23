import { dropNearDuplicates, largestDuplicateCluster } from './retrieval-guard';

const unit = (...values: number[]) => {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
  return values.map((v) => v / norm);
};

const injected = unit(1, 0, 0);
const legit = [unit(0, 1, 0), unit(0, 0, 1), unit(0, 1, 1)];

describe('dropNearDuplicates', () => {
  it('keeps one copy of a repeated chunk so it cannot fill every slot', () => {
    const items = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `copy${i}`, embedding: injected })),
      ...legit.map((embedding, i) => ({ id: `legit${i}`, embedding })),
    ];
    expect(dropNearDuplicates(items, 3).map((i) => i.id)).toEqual(['copy0', 'legit0', 'legit1']);
  });

  it('respects the limit and the original order', () => {
    const items = legit.map((embedding, i) => ({ id: i, embedding }));
    expect(dropNearDuplicates(items, 2).map((i) => i.id)).toEqual([0, 1]);
  });
});

describe('largestDuplicateCluster', () => {
  it('counts the biggest group of near-identical vectors', () => {
    expect(largestDuplicateCluster([injected, injected, injected, ...legit])).toBe(3);
    expect(largestDuplicateCluster(legit)).toBe(1);
    expect(largestDuplicateCluster([])).toBe(0);
  });
});
