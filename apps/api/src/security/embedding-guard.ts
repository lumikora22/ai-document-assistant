/** Dimensão do Xenova/all-MiniLM-L6-v2, a mesma das colunas vector(384). */
export const EMBEDDING_DIMENSIONS = 384;

/** Os vetores são normalizados; uma norma longe de 1 indica saída corrompida. */
const NORM_TOLERANCE = 0.05;

export class InvalidEmbeddingError extends Error {}

/**
 * Garante que o vetor pode ir para o pgvector: dimensão certa, só números
 * finitos e norma unitária. Um vetor com NaN ou zerado quebra a distância de
 * cosseno e faria o trecho aparecer (ou sumir) em qualquer busca.
 */
export function assertValidEmbedding(vector: number[], dimensions = EMBEDDING_DIMENSIONS): void {
  if (!Array.isArray(vector) || vector.length !== dimensions) {
    throw new InvalidEmbeddingError(`Embedding must have ${dimensions} dimensions, got ${vector?.length}`);
  }
  let sumOfSquares = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new InvalidEmbeddingError('Embedding contains a non-finite value');
    }
    sumOfSquares += value * value;
  }
  const norm = Math.sqrt(sumOfSquares);
  if (Math.abs(norm - 1) > NORM_TOLERANCE) {
    throw new InvalidEmbeddingError(`Embedding norm should be 1, got ${norm.toFixed(3)}`);
  }
}
