import { Inject, Injectable } from '@nestjs/common';
import { cosineDistance, eq, sql } from 'drizzle-orm';
import { AnalystAgent } from '../agents/analyst.agent';
import { ConversationAgent } from '../agents/conversation.agent';
import { Database, DRIZZLE } from '../database/database.module';
import { noteChunks } from '../database/schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { OpenRouterService } from '../llm/openrouter.service';
import { MemoryService } from '../memory/memory.service';
import { NotesService } from '../notes/notes.service';
import { StreamingOutputGuard } from '../security/output-guard';
import { dropNearDuplicates } from '../security/retrieval-guard';
import { SecurityService } from '../security/security.service';
import { RetrievedChunk } from './prompt';

const TOP_K = 5;
/** Candidatos buscados no pgvector antes de descartar os quase duplicados. */
const CANDIDATES = TOP_K * 4;
const MAX_HISTORY_MESSAGES = 10;
/** Perguntas anteriores que o analista recebe para entender perguntas de continuação. */
const ANALYST_PREVIOUS_QUESTIONS = 2;
const LEAK_NOTICE = '\n\n[Resposta interrompida: ela estava expondo as instruções internas do assistente.]';

export interface ChatSource {
  id: string;
  content: string;
  similarity: number;
}

export interface ChatStream {
  /** Conversation the messages were saved to; the client sends it back to continue it. */
  conversationId: string;
  sources: ChatSource[];
  tokens: AsyncGenerator<string>;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
    private readonly notes: NotesService,
    private readonly memory: MemoryService,
    private readonly llm: OpenRouterService,
    private readonly security: SecurityService,
    private readonly analyst: AnalystAgent,
    private readonly conversation: ConversationAgent,
  ) {}

  /**
   * Runs the two-agent RAG flow: embed the question, retrieve the most
   * similar chunks and earlier memories with pgvector plus the related
   * relations of the entity graph, let the analyst agent (cheap model) turn
   * all of it into a short report, and stream the conversation agent's answer
   * (main model) built from that report. The exchange is saved and turned
   * into memory afterwards.
   */
  async ask(noteId: string, rawMessage: string, conversationId?: string): Promise<ChatStream> {
    this.llm.assertConfigured();
    const note = await this.notes.findOne(noteId);
    // Bloqueia injeção direta antes de gravar ou gastar qualquer coisa com a mensagem.
    const message = await this.security.inspectUserMessage(rawMessage, noteId);
    const conversation = await this.memory.ensureConversation(noteId, conversationId);

    // O histórico vem do banco, não do cliente, que poderia forjar falas do assistente.
    const history = await this.memory.recentMessages(conversation, MAX_HISTORY_MESSAGES);
    const questionVector = await this.embeddings.embedOne(message);
    const [retrieved, memories] = await Promise.all([
      this.retrieveChunks(noteId, questionVector),
      this.memory.findRelevantMemories(noteId, questionVector, conversation),
    ]);
    const chunks = retrieved.map((chunk) => ({ ...chunk, suspicious: this.security.isSuspicious(chunk.content) }));
    await this.memory.addMessage(conversation, 'user', message);
    await this.memory.recordRagQuery(noteId, conversation, message, chunks);

    const relations = await this.memory.findRelatedRelations(
      noteId,
      [message, ...chunks.map((chunk) => chunk.content)].join('\n'),
    );
    const previousQuestions = history
      .filter((m) => m.role === 'user')
      .slice(-ANALYST_PREVIOUS_QUESTIONS)
      .map((m) => m.content);

    const analysis = await this.analyst.analyze(
      { question: message, note, chunks, memories, relations, previousQuestions },
      noteId,
    );
    const { tokens, guard } = await this.conversation.respond(
      { question: message, note, history, analysis, chunks, memories },
      noteId,
    );

    return {
      conversationId: conversation,
      sources: chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.similarity,
      })),
      tokens: this.guardAndSave(noteId, conversation, tokens, guard),
    };
  }

  /**
   * Passes the tokens through the output guard, then stores what the user
   * actually saw and refreshes the memory. A leaked answer is cut off and
   * never reaches the history or the memory.
   */
  private async *guardAndSave(
    noteId: string,
    conversationId: string,
    tokens: AsyncGenerator<string>,
    guard: StreamingOutputGuard,
  ): AsyncGenerator<string> {
    let raw = '';
    let shown = '';
    try {
      for await (const token of tokens) {
        raw += token;
        const safe = guard.push(token);
        if (guard.leaked) break;
        if (safe) {
          shown += safe;
          yield safe;
        }
      }
      const rest = guard.flush();
      if (rest) {
        shown += rest;
        yield rest;
      }
      if (guard.leaked) yield LEAK_NOTICE;
    } finally {
      await this.security.recordOutput(noteId, [...guard.findings], guard.leaked, raw);
    }

    if (shown.trim() && !guard.leaked) {
      await this.memory.addMessage(conversationId, 'assistant', shown);
      this.memory.scheduleUpdate(conversationId);
    }
  }

  private async retrieveChunks(noteId: string, questionVector: number[]): Promise<RetrievedChunk[]> {
    const distance = cosineDistance(noteChunks.embedding, questionVector);
    const rows = await this.db
      .select({
        id: noteChunks.id,
        content: noteChunks.content,
        embedding: noteChunks.embedding,
        similarity: sql<number>`1 - (${distance})`.mapWith(Number),
      })
      .from(noteChunks)
      .where(eq(noteChunks.noteId, noteId))
      .orderBy(distance)
      .limit(CANDIDATES);
    // Um texto repetido muitas vezes na nota não pode ocupar todas as vagas do prompt.
    return dropNearDuplicates(rows, TOP_K).map(({ embedding: _embedding, ...chunk }) => chunk);
  }
}
