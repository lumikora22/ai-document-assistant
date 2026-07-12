import { Injectable, Logger } from '@nestjs/common';

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
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private pipelinePromise?: Promise<FeatureExtractionPipeline>;

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
    }
    return this.pipelinePromise;
  }

  /** Embeds a batch of texts. Returns one 384-dimensional vector per text. */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const pipeline = await this.loadPipeline();
    const output = await pipeline(texts, { pooling: 'mean', normalize: true });
    return output.tolist();
  }

  /** Embeds a single text. */
  async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    return vector;
  }
}
