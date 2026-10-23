import { Injectable } from '@nestjs/common';
import { buildRagMessages, ChatHistoryMessage, NoteContext, RAG_RULES, RetrievedChunk } from '../chat/prompt';
import { OpenRouterService } from '../llm/openrouter.service';
import { createCanary, StreamingOutputGuard } from '../security/output-guard';
import { SecurityService } from '../security/security.service';
import type { Analysis } from './analyst.prompt';
import { buildConversationMessages, CONVERSATION_RULES } from './conversation.prompt';

export interface ConversationInput {
  question: string;
  note: NoteContext;
  history: ChatHistoryMessage[];
  /** Relatório do analista; null quando ele falhou. */
  analysis: Analysis | null;
  /** Usados só no fallback, quando não há relatório. */
  chunks: RetrievedChunk[];
  memories: string[];
}

export interface ConversationReply {
  tokens: AsyncGenerator<string>;
  /** Filtro de saída que o chamador aplica a cada token antes de mostrá-lo. */
  guard: StreamingOutputGuard;
}

/**
 * Agente 1: o único que conversa com o usuário. Roda no modelo principal
 * (OPENROUTER_MODEL) com o contexto pequeno que o analista preparou.
 */
@Injectable()
export class ConversationAgent {
  constructor(
    private readonly llm: OpenRouterService,
    private readonly security: SecurityService,
  ) {}

  async respond(input: ConversationInput, noteId: string): Promise<ConversationReply> {
    const canary = createCanary();
    // Sem relatório, responde direto dos trechos, como antes de existirem dois agentes.
    const [messages, rules] = input.analysis
      ? [buildConversationMessages(input.question, input.note, input.analysis, input.history, canary), CONVERSATION_RULES]
      : [buildRagMessages(input.question, input.note, input.chunks, input.history, input.memories, canary), RAG_RULES];

    const redacted = await this.security.redactForLlm(messages, noteId);
    return { tokens: this.llm.stream(redacted), guard: new StreamingOutputGuard(canary, rules) };
  }
}
