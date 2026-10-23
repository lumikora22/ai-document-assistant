import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import type { EntityKind } from '../memory/memory-extraction';
import type { SecurityEventKind, SecurityEventSource, SecurityAction } from '../security/security-events';
import { NoteType } from '../notes/note-types';

/**
 * Schema do Drizzle para as notas e os chunks com embeddings usados no pipeline de RAG.
 *
 * As tabelas e colunas no banco têm nomes em português; no código, os campos
 * continuam em inglês, que é o formato do JSON devolvido pela API.
 *
 * Depois de alterar este arquivo, rode `npm run db:generate` para criar uma migration,
 * que é aplicada automaticamente quando a API inicia.
 * A dimensão do embedding (384) corresponde ao modelo Xenova/all-MiniLM-L6-v2.
 */
export const notes = pgTable('notas', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('titulo').notNull(),
  type: text('tipo').$type<NoteType>().notNull(),
  content: text('conteudo').notNull(),
  createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const noteEntries = pgTable(
  'entradas_nota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    content: text('conteudo').notNull(),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_entradas_nota_nota_id').on(table.noteId)],
);

export const noteChunks = pgTable(
  'trechos_nota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    content: text('conteudo').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
  },
  (table) => [index('idx_trechos_nota_nota_id').on(table.noteId)],
);

/** Uma sessão de chat sobre uma nota. A memória é construída a partir dela. */
export const conversations = pgTable(
  'conversas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_conversas_nota_id').on(table.noteId)],
);

export const conversationMessages = pgTable(
  'mensagens_conversa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversa_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('papel').$type<'user' | 'assistant'>().notNull(),
    content: text('conteudo').notNull(),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_mensagens_conversa_conversa_id').on(table.conversationId)],
);

/**
 * Memória de longo prazo: um resumo por conversa, gerado pelo LLM a partir da
 * conversa e da nota. O embedding permite buscar memórias relevantes em
 * conversas futuras.
 */
export const memories = pgTable(
  'memorias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversa_id')
      .notNull()
      .unique()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    summary: text('resumo').notNull(),
    messageCount: integer('quantidade_mensagens').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    updatedAt: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_memorias_nota_id').on(table.noteId)],
);

/** Nós do grafo de entidades, extraídos das conversas. Únicos por nota. */
export const memoryEntities = pgTable(
  'entidades_memoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    name: text('nome').notNull(),
    /** Nome normalizado (minúsculas, sem espaços extras) usado para não duplicar a entidade. */
    key: text('chave').notNull(),
    kind: text('tipo').$type<EntityKind>().notNull(),
  },
  (table) => [uniqueIndex('uq_entidades_memoria_nota_chave').on(table.noteId, table.key)],
);

/** Arestas do grafo de entidades. */
export const memoryEdges = pgTable(
  'relacoes_memoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    sourceId: uuid('origem_id')
      .notNull()
      .references(() => memoryEntities.id, { onDelete: 'cascade' }),
    targetId: uuid('destino_id')
      .notNull()
      .references(() => memoryEntities.id, { onDelete: 'cascade' }),
    label: text('rotulo').notNull(),
  },
  (table) => [
    uniqueIndex('uq_relacoes_memoria').on(table.sourceId, table.targetId, table.label),
    index('idx_relacoes_memoria_nota_id').on(table.noteId),
  ],
);

/** Cada pergunta feita no chat, para montar o grafo RAG. */
export const ragQueries = pgTable(
  'consultas_rag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversa_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    question: text('pergunta').notNull(),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_consultas_rag_nota_id').on(table.noteId)],
);

/** Trechos que o pgvector recuperou para cada pergunta, com a similaridade. */
export const ragQueryChunks = pgTable(
  'consultas_rag_trechos',
  {
    queryId: uuid('consulta_id')
      .notNull()
      .references(() => ragQueries.id, { onDelete: 'cascade' }),
    chunkId: uuid('trecho_id')
      .notNull()
      .references(() => noteChunks.id, { onDelete: 'cascade' }),
    similarity: real('similaridade').notNull(),
  },
  (table) => [primaryKey({ columns: [table.queryId, table.chunkId] })],
);

export const notesRelations = relations(notes, ({ many }) => ({
  entries: many(noteEntries),
  chunks: many(noteChunks),
}));

export const noteEntriesRelations = relations(noteEntries, ({ one }) => ({
  note: one(notes, { fields: [noteEntries.noteId], references: [notes.id] }),
}));

export const noteChunksRelations = relations(noteChunks, ({ one }) => ({
  note: one(notes, { fields: [noteChunks.noteId], references: [notes.id] }),
}));

/**
 * Registro de auditoria das defesas de segurança: mensagens bloqueadas,
 * trechos com possível injeção indireta, memórias rejeitadas e embeddings
 * inválidos. A nota é opcional e o evento sobrevive à exclusão dela.
 */
export const securityEvents = pgTable(
  'eventos_seguranca',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('tipo').$type<SecurityEventKind>().notNull(),
    source: text('origem').$type<SecurityEventSource>().notNull(),
    action: text('acao').$type<SecurityAction>().notNull(),
    noteId: uuid('nota_id').references(() => notes.id, { onDelete: 'set null' }),
    score: real('pontuacao').notNull(),
    rules: jsonb('regras').$type<string[]>().notNull(),
    excerpt: text('trecho').notNull(),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_eventos_seguranca_criado_em').on(table.createdAt)],
);
