import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { toSqlVector } from '../shared/vector';
import { buildRagMessages, ChatCompletionMessage, ChatHistoryMessage, RetrievedChunk } from './prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const TOP_K = 5;

export interface ChatSource {
  id: string;
  page: number;
  content: string;
  similarity: number;
}

export interface ChatStream {
  sources: ChatSource[];
  tokens: AsyncGenerator<string>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly embeddings: EmbeddingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs the full RAG flow: embed the question, retrieve the most similar
   * chunks with pgvector, build the prompt, and stream the completion.
   */
  async ask(documentId: string, message: string, history: ChatHistoryMessage[]): Promise<ChatStream> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is not configured. Set it in the .env file to enable chat.',
      );
    }

    await this.assertDocumentExists(documentId);

    const chunks = await this.retrieveChunks(documentId, message);
    const messages = buildRagMessages(message, chunks, history);
    const tokens = this.streamCompletion(apiKey, messages);

    return {
      sources: chunks.map((chunk) => ({
        id: chunk.id,
        page: chunk.page,
        content: chunk.content,
        similarity: chunk.similarity,
      })),
      tokens,
    };
  }

  private async assertDocumentExists(documentId: string): Promise<void> {
    const result = await this.pool.query('SELECT 1 FROM documents WHERE id = $1', [documentId]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Document ${documentId} was not found`);
    }
  }

  private async retrieveChunks(documentId: string, question: string): Promise<RetrievedChunk[]> {
    const questionVector = await this.embeddings.embedOne(question);
    const result = await this.pool.query<{
      id: string;
      content: string;
      page: number;
      similarity: number;
    }>(
      `SELECT id, content, page, 1 - (embedding <=> $1::vector) AS similarity
       FROM chunks
       WHERE document_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [toSqlVector(questionVector), documentId, TOP_K],
    );
    return result.rows.map((row) => ({ ...row, similarity: Number(row.similarity) }));
  }

  private async *streamCompletion(
    apiKey: string,
    messages: ChatCompletionMessage[],
  ): AsyncGenerator<string> {
    const model = this.config.get<string>('OPENROUTER_MODEL', DEFAULT_MODEL);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('OpenRouter rejected the API key. Check OPENROUTER_API_KEY.');
    }
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`OpenRouter request failed (${response.status}): ${detail}`);
      throw new ServiceUnavailableException(`OpenRouter request failed with status ${response.status}`);
    }

    const decoder = new TextDecoder();
    let buffered = '';

    for await (const value of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffered += decoder.decode(value, { stream: true });

      let newlineIndex = buffered.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);
        newlineIndex = buffered.indexOf('\n');

        if (!line.startsWith('data:')) {
          continue;
        }
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed keep-alive lines from the upstream stream.
        }
      }
    }
  }
}
