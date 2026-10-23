import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { assertValidEmbedding } from '../security/embedding-guard';
import { sanitizeText } from '../security/sanitize';

/**
 * Minimal shape of the feature-extraction pipeline returned by
 * @xenova/transformers. Typed locally to avoid importing the ESM-only
 * package at compile time from this CommonJS project.
 */
type FeatureExtractionPipeline = (
  texts: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

/**
 * Generates sentence embeddings locally using @xenova/transformers.
 *
 * The model (384-dimensional MiniLM) is downloaded on first use and cached
 * on disk, so no external embedding API is required.
 */
@Injectable()
export class EmbeddingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmbeddingsService.name);
  private pipelinePromise?: Promise<FeatureExtractionPipeline>;

  /**
   * Starts loading the model as soon as the API is up, without blocking
   * startup, so the first note saved does not pay the ~3s load time.
   */
  onApplicationBootstrap(): void {
    this.loadPipeline().catch((error) =>
      this.logger.error(`Failed to preload embedding model: ${error}`),
    );
  }

  private loadPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.logger.log(`Loading embedding model ${MODEL_ID} (first run downloads it)`);
      // @xenova/transformers is ESM-only. A direct dynamic import would be
      // transpiled to require() by the CommonJS TypeScript output, which
      // fails at runtime, so the import is built through the Function
      // constructor to keep it a true dynamic import.
      const importEsm = new Function('specifier', 'return import(specifier)') as (
        specifier: string,
      ) => Promise<{ pipeline: (task: string, model: string) => Promise<FeatureExtractionPipeline> }>;
      this.pipelinePromise = importEsm('@xenova/transformers').then((transformers) =>
        transformers.pipeline('feature-extraction', MODEL_ID),
      );
      // A failed load (e.g. no network on the first download) is retried on the next call.
      this.pipelinePromise.catch(() => {
        this.pipelinePromise = undefined;
      });
    }
    return this.pipelinePromise;
  }

  /**
   * Embeds a batch of texts. Returns one 384-dimensional vector per text.
   *
   * Invisible characters are stripped first so hidden text cannot steer what
   * a chunk is retrieved for, and every vector is validated before it can
   * reach pgvector.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const pipeline = await this.loadPipeline();
    const output = await pipeline(texts.map(sanitizeText), { pooling: 'mean', normalize: true });
    const vectors = output.tolist();
    vectors.forEach((vector) => assertValidEmbedding(vector));
    return vectors;
  }

  /** Embeds a single text. */
  async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    return vector;
  }
}
