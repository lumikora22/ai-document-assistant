import { assertValidEmbedding, InvalidEmbeddingError } from './embedding-guard';

const unit = (dimensions = 384) => {
  const vector = Array.from({ length: dimensions }, (_, i) => (i % 2 === 0 ? 1 : -1));
  const norm = Math.sqrt(dimensions);
  return vector.map((v) => v / norm);
};

describe('assertValidEmbedding', () => {
  it('accepts a normalised vector of the right size', () => {
    expect(() => assertValidEmbedding(unit())).not.toThrow();
  });

  it('rejects the wrong dimension', () => {
    expect(() => assertValidEmbedding(unit(383))).toThrow(InvalidEmbeddingError);
  });

  it('rejects NaN and Infinity', () => {
    const withNaN = unit();
    withNaN[10] = NaN;
    const withInfinity = unit();
    withInfinity[0] = Infinity;
    expect(() => assertValidEmbedding(withNaN)).toThrow(InvalidEmbeddingError);
    expect(() => assertValidEmbedding(withInfinity)).toThrow(InvalidEmbeddingError);
  });

  it('rejects a zero or unnormalised vector', () => {
    expect(() => assertValidEmbedding(new Array(384).fill(0))).toThrow(InvalidEmbeddingError);
    expect(() => assertValidEmbedding(unit().map((v) => v * 3))).toThrow(InvalidEmbeddingError);
  });
});
