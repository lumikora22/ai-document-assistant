/** Acima disto, dois trechos dizem praticamente a mesma coisa. */
export const NEAR_DUPLICATE_SIMILARITY = 0.95;

/** Quantas cópias do mesmo texto num envio indicam inundação, e não repetição comum. */
export const FLOOD_MIN_COPIES = 3;

/**
 * Mantém a ordem e descarta itens quase idênticos a um já escolhido, até
 * `limit`. Sem isso, um texto colado várias vezes (por exemplo, uma instrução
 * escondida repetida num PDF) ocupa todas as vagas do top-k e expulsa o
 * conteúdo legítimo do prompt.
 */
export function dropNearDuplicates<T extends { embedding: number[] }>(
  items: T[],
  limit: number,
  threshold = NEAR_DUPLICATE_SIMILARITY,
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    if (kept.length >= limit) break;
    if (!kept.some((k) => dot(k.embedding, item.embedding) >= threshold)) kept.push(item);
  }
  return kept;
}

/**
 * Tamanho do maior grupo de vetores quase idênticos num lote. Usado na
 * indexação para sinalizar uma nota que tenta dominar a busca por repetição.
 */
export function largestDuplicateCluster(vectors: number[][], threshold = NEAR_DUPLICATE_SIMILARITY): number {
  let largest = vectors.length > 0 ? 1 : 0;
  const counted = new Set<number>();
  for (let i = 0; i < vectors.length; i++) {
    if (counted.has(i)) continue;
    let size = 1;
    for (let j = i + 1; j < vectors.length; j++) {
      if (!counted.has(j) && dot(vectors[i], vectors[j]) >= threshold) {
        counted.add(j);
        size++;
      }
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

/** Os embeddings são normalizados, então o produto escalar é a similaridade de cosseno. */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
