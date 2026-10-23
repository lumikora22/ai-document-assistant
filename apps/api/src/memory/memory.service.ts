import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, cosineDistance, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import {
  conversationMessages,
  conversations,
  memories,
  memoryEdges,
  memoryEntities,
  noteChunks,
  notes,
  ragQueries,
  ragQueryChunks,
} from '../database/schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { OpenRouterService } from '../llm/openrouter.service';
import { NotesService } from '../notes/notes.service';
import { SecurityService } from '../security/security.service';
import { NoteType } from '../notes/note-types';
import { buildMemoryMessages, EntityKind, entityKey, parseMemoryExtraction } from './memory-extraction';

export interface ConversationMemory {
  id: string;
  noteId: string;
  noteTitle: string;
  noteType: NoteType;
  summary: string;
  messageCount: number;
  updatedAt: Date;
}

export type GraphNodeKind = EntityKind | 'query' | 'chunk' | 'note';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  /** Full text shown when the node is selected (e.g. the chunk content). */
  detail?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RecordedChunk {
  id: string;
  similarity: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Memories less similar than this to the question are not worth putting in the prompt. */
const MIN_MEMORY_SIMILARITY = 0.25;
const RELEVANT_MEMORIES = 3;
const RAG_GRAPH_QUERIES = 5;
/** Entities of the note checked for a mention in the question and the chunks. */
const GRAPH_ENTITY_SCAN = 200;
const RELATED_RELATIONS = 15;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  /** Memory updates in flight, chained per conversation so they never overlap. */
  private readonly pendingUpdates = new Map<string, Promise<void>>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
    private readonly notes: NotesService,
    private readonly llm: OpenRouterService,
    private readonly security: SecurityService,
  ) {}

  /** Returns the conversation to continue, or starts a new one when the id is missing or belongs to another note. */
  async ensureConversation(noteId: string, conversationId?: string): Promise<string> {
    if (conversationId && UUID_PATTERN.test(conversationId)) {
      const [existing] = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.noteId, noteId)));
      if (existing) {
        return existing.id;
      }
    }
    const [created] = await this.db
      .insert(conversations)
      .values({ noteId })
      .returning({ id: conversations.id });
    return created.id;
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    await this.db.insert(conversationMessages).values({ conversationId, role, content });
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * The latest messages of the conversation, oldest first. The chat uses this
   * instead of a history sent by the client, which could forge assistant turns.
   */
  async recentMessages(conversationId: string, limit: number): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const rows = await this.db
      .select({ role: conversationMessages.role, content: conversationMessages.content })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  /** Saves which chunks pgvector retrieved for a question, for the RAG graph. */
  async recordRagQuery(
    noteId: string,
    conversationId: string,
    question: string,
    chunks: RecordedChunk[],
  ): Promise<void> {
    const [query] = await this.db
      .insert(ragQueries)
      .values({ noteId, conversationId, question })
      .returning({ id: ragQueries.id });
    if (chunks.length > 0) {
      await this.db
        .insert(ragQueryChunks)
        .values(chunks.map((chunk) => ({ queryId: query.id, chunkId: chunk.id, similarity: chunk.similarity })));
    }
  }

  /** Summaries of earlier conversations about the note that relate to the question. */
  async findRelevantMemories(
    noteId: string,
    questionVector: number[],
    excludeConversationId: string,
  ): Promise<string[]> {
    const distance = cosineDistance(memories.embedding, questionVector);
    const rows = await this.db
      .select({
        summary: memories.summary,
        similarity: sql<number>`1 - (${distance})`.mapWith(Number),
      })
      .from(memories)
      .where(and(eq(memories.noteId, noteId), ne(memories.conversationId, excludeConversationId)))
      .orderBy(distance)
      .limit(RELEVANT_MEMORIES);
    return rows.filter((row) => row.similarity >= MIN_MEMORY_SIMILARITY).map((row) => row.summary);
  }

  /**
   * GraphRAG: relations of the entity graph that touch an entity mentioned in
   * `text` (the question plus the retrieved chunks), as "A -[label]-> B".
   * Gives the analyst the links between characters, places and events that
   * no single chunk states.
   */
  async findRelatedRelations(noteId: string, text: string): Promise<string[]> {
    const haystack = entityKey(text);
    const entities = await this.db
      .select({ id: memoryEntities.id, name: memoryEntities.name, key: memoryEntities.key })
      .from(memoryEntities)
      .where(eq(memoryEntities.noteId, noteId))
      .limit(GRAPH_ENTITY_SCAN);
    const mentioned = entities.filter((e) => e.key.length >= 3 && haystack.includes(e.key)).map((e) => e.id);
    if (mentioned.length === 0) {
      return [];
    }

    const edges = await this.db
      .select({ from: memoryEdges.sourceId, to: memoryEdges.targetId, label: memoryEdges.label })
      .from(memoryEdges)
      .where(
        and(
          eq(memoryEdges.noteId, noteId),
          or(inArray(memoryEdges.sourceId, mentioned), inArray(memoryEdges.targetId, mentioned)),
        ),
      )
      .limit(RELATED_RELATIONS);
    const nameById = new Map(entities.map((e) => [e.id, e.name]));
    return edges.flatMap((edge) => {
      const from = nameById.get(edge.from);
      const to = nameById.get(edge.to);
      return from && to ? [`${from} -[${edge.label}]-> ${to}`] : [];
    });
  }

  /**
   * Rebuilds the conversation's memory in the background. Failures are only
   * logged: the chat answer was already delivered and the next message retries.
   */
  scheduleUpdate(conversationId: string): void {
    const previous = this.pendingUpdates.get(conversationId) ?? Promise.resolve();
    const next = previous
      .then(() => this.updateMemory(conversationId))
      .catch((error) => this.logger.warn(`Memory update failed for ${conversationId}: ${error}`))
      .finally(() => {
        if (this.pendingUpdates.get(conversationId) === next) {
          this.pendingUpdates.delete(conversationId);
        }
      });
    this.pendingUpdates.set(conversationId, next);
  }

  /** Summarises the conversation with its note and stores the summary, entities and relations. */
  private async updateMemory(conversationId: string): Promise<void> {
    const [conversation] = await this.db
      .select({ noteId: conversations.noteId })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conversation) {
      return; // The note was deleted while the update was queued.
    }
    const { noteId } = conversation;

    const [note, messages, known] = await Promise.all([
      this.notes.findOne(noteId),
      this.db
        .select({ role: conversationMessages.role, content: conversationMessages.content })
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(asc(conversationMessages.createdAt)),
      this.db
        .select({ name: memoryEntities.name })
        .from(memoryEntities)
        .where(eq(memoryEntities.noteId, noteId))
        .limit(100),
    ]);
    // Mensagens que parecem instruções (injeção que passou abaixo do limite de
    // bloqueio, ou uma resposta que a repetiu) não entram na memória.
    const trusted = messages.filter((m) => !this.security.isSuspicious(m.content));
    if (trusted.length === 0) {
      return;
    }

    const knownEntities = known.map((e) => e.name);
    const prompt = await this.security.redactForLlm(
      buildMemoryMessages({ note, messages: trusted, knownEntities }),
      noteId,
    );
    const reply = await this.llm.complete(prompt);
    const extraction = parseMemoryExtraction(reply, knownEntities);
    if (!extraction) {
      this.logger.warn(`Model reply for conversation ${conversationId} had no usable memory`);
      return;
    }
    if (!(await this.security.vetMemory(extraction, noteId))) {
      return;
    }

    const userText = trusted
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');
    const [embedding, conversationVector] = await this.embeddings.embed([extraction.summary, userText]);
    if (!(await this.security.checkMemoryGrounding(noteId, extraction.summary, embedding, conversationVector))) {
      return;
    }

    await this.db.transaction(async (tx) => {
      const values = {
        noteId,
        conversationId,
        summary: extraction.summary,
        messageCount: messages.length,
        embedding,
        updatedAt: new Date(),
      };
      await tx
        .insert(memories)
        .values(values)
        .onConflictDoUpdate({ target: memories.conversationId, set: values });

      if (extraction.entities.length > 0) {
        await tx
          .insert(memoryEntities)
          .values(extraction.entities.map((e) => ({ noteId, name: e.name, key: entityKey(e.name), kind: e.kind })))
          .onConflictDoNothing({ target: [memoryEntities.noteId, memoryEntities.key] });
      }
      if (extraction.relations.length === 0) {
        return;
      }

      // Relations can also point at entities saved by earlier conversations.
      const keys = extraction.relations.flatMap((r) => [entityKey(r.from), entityKey(r.to)]);
      const rows = await tx
        .select({ id: memoryEntities.id, key: memoryEntities.key })
        .from(memoryEntities)
        .where(and(eq(memoryEntities.noteId, noteId), inArray(memoryEntities.key, keys)));
      const idByKey = new Map(rows.map((row) => [row.key, row.id]));

      const edges = extraction.relations.flatMap((relation) => {
        const sourceId = idByKey.get(entityKey(relation.from));
        const targetId = idByKey.get(entityKey(relation.to));
        return sourceId && targetId ? [{ noteId, sourceId, targetId, label: relation.label }] : [];
      });
      if (edges.length > 0) {
        await tx.insert(memoryEdges).values(edges).onConflictDoNothing();
      }
    });
    this.logger.log(
      `Memory updated for conversation ${conversationId}: ${extraction.entities.length} entities, ${extraction.relations.length} relations`,
    );
  }

  /** Memories of one note, or of every note, most recent first. */
  async listMemories(noteId?: string): Promise<ConversationMemory[]> {
    return this.db
      .select({
        id: memories.id,
        noteId: memories.noteId,
        noteTitle: notes.title,
        noteType: notes.type,
        summary: memories.summary,
        messageCount: memories.messageCount,
        updatedAt: memories.updatedAt,
      })
      .from(memories)
      .innerJoin(notes, eq(notes.id, memories.noteId))
      .where(noteId ? eq(memories.noteId, noteId) : undefined)
      .orderBy(desc(memories.updatedAt))
      .limit(50);
  }

  /** Entities and relations extracted from the conversations. */
  async entityGraph(noteId?: string): Promise<MemoryGraph> {
    const [entities, edges] = await Promise.all([
      this.db
        .select({ id: memoryEntities.id, name: memoryEntities.name, kind: memoryEntities.kind })
        .from(memoryEntities)
        .where(noteId ? eq(memoryEntities.noteId, noteId) : undefined),
      this.db
        .select({ from: memoryEdges.sourceId, to: memoryEdges.targetId, label: memoryEdges.label })
        .from(memoryEdges)
        .where(noteId ? eq(memoryEdges.noteId, noteId) : undefined),
    ]);
    return {
      nodes: entities.map((e) => ({ id: e.id, label: e.name, kind: e.kind })),
      edges,
    };
  }

  /** The latest questions, the chunks pgvector retrieved for each and the notes they belong to. */
  async ragGraph(noteId?: string): Promise<MemoryGraph> {
    const queries = await this.db
      .select({ id: ragQueries.id, question: ragQueries.question })
      .from(ragQueries)
      .where(noteId ? eq(ragQueries.noteId, noteId) : undefined)
      .orderBy(desc(ragQueries.createdAt))
      .limit(RAG_GRAPH_QUERIES);
    if (queries.length === 0) {
      return { nodes: [], edges: [] };
    }

    const hits = await this.db
      .select({
        queryId: ragQueryChunks.queryId,
        chunkId: noteChunks.id,
        chunkContent: noteChunks.content,
        similarity: ragQueryChunks.similarity,
        noteId: notes.id,
        noteTitle: notes.title,
      })
      .from(ragQueryChunks)
      .innerJoin(noteChunks, eq(noteChunks.id, ragQueryChunks.chunkId))
      .innerJoin(notes, eq(notes.id, noteChunks.noteId))
      .where(
        inArray(
          ragQueryChunks.queryId,
          queries.map((q) => q.id),
        ),
      );

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    for (const query of queries) {
      nodes.set(`q:${query.id}`, {
        id: `q:${query.id}`,
        label: shorten(query.question, 28),
        kind: 'query',
        detail: query.question,
      });
    }
    for (const hit of hits) {
      const chunkNode = `c:${hit.chunkId}`;
      const noteNode = `n:${hit.noteId}`;
      if (!nodes.has(chunkNode)) {
        nodes.set(chunkNode, {
          id: chunkNode,
          label: shorten(hit.chunkContent, 18),
          kind: 'chunk',
          detail: hit.chunkContent,
        });
        nodes.set(noteNode, { id: noteNode, label: hit.noteTitle, kind: 'note' });
        edges.push({ from: chunkNode, to: noteNode, label: '' });
      }
      edges.push({ from: `q:${hit.queryId}`, to: chunkNode, label: `${Math.round(hit.similarity * 100)}%` });
    }
    return { nodes: [...nodes.values()], edges };
  }
}

function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
