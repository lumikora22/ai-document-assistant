/**
 * Serializes a numeric vector into the literal format expected by the
 * pgvector extension, e.g. "[0.1,0.2,0.3]".
 */
export function toSqlVector(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
