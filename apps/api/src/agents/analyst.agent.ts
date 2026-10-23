import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService } from '../llm/openrouter.service';
import { createCanary } from '../security/output-guard';
import { SecurityService } from '../security/security.service';
import { Analysis, AnalystInput, buildAnalystMessages, parseAnalysis } from './analyst.prompt';

/** Modelo pequeno e barato: ele lê o contexto grande, mas só devolve um relatório curto. */
const DEFAULT_ANALYST_MODEL = 'google/gemma-3-12b-it:free';
const DEFAULT_ANALYST_MAX_TOKENS = 1024;

/**
 * Agente 2: analisa o que o RAG (trechos do pgvector e memórias) e o GraphRAG
 * (relações do grafo de entidades) trouxeram do banco e entrega os fatos ao
 * agente de conversa. Nunca fala com o usuário.
 */
@Injectable()
export class AnalystAgent {
  private readonly logger = new Logger(AnalystAgent.name);

  constructor(
    private readonly llm: OpenRouterService,
    private readonly security: SecurityService,
    private readonly config: ConfigService,
  ) {}

  /** O relatório já validado, ou null se o analista falhou (o chat cai no fluxo de um agente só). */
  async analyze(input: AnalystInput, noteId: string): Promise<Analysis | null> {
    const canary = createCanary();
    const messages = await this.security.redactForLlm(buildAnalystMessages(input, canary), noteId);

    let reply: string;
    try {
      reply = await this.llm.complete(messages, {
        model: this.config.get<string>('OPENROUTER_ANALYST_MODEL') || DEFAULT_ANALYST_MODEL,
        maxTokens: Number(this.config.get('LLM_ANALYST_MAX_TOKENS')) || DEFAULT_ANALYST_MAX_TOKENS,
      });
    } catch (error) {
      this.logger.warn(`Analyst agent failed, falling back to a single agent: ${(error as Error).message}`);
      return null;
    }

    const analysis = parseAnalysis(reply, input.chunks.length);
    if (!analysis) {
      this.logger.warn('Analyst agent reply had no usable JSON, falling back to a single agent');
      return null;
    }
    // A saída do analista é tão pouco confiável quanto os trechos que ele leu.
    return this.security.vetAnalysis(analysis, noteId, canary);
  }
}
