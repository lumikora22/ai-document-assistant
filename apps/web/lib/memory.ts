import type { NoteType } from './api';

// Shapes returned by the API's /memory endpoints, which the memory pop-up renders.

export interface ConversationMemory {
  id: string;
  noteId: string;
  noteTitle: string;
  noteType: NoteType;
  summary: string;
  messageCount: number;
  updatedAt: string;
}

export type GraphNodeKind =
  | 'character'
  | 'place'
  | 'item'
  | 'event'
  | 'concept'
  // RAG graph: a question, the chunks retrieved for it and the notes they came from.
  | 'query'
  | 'chunk'
  | 'note';

/** Graphs the "conversation graphs" tab can show; add new ones here and in the API. */
export const GRAPH_VIEWS = ['entities', 'rag'] as const;
export type GraphView = (typeof GRAPH_VIEWS)[number];

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

export const GRAPH_NODE_COLORS: Record<GraphNodeKind, string> = {
  character: '#6366f1',
  place: '#10b981',
  item: '#f59e0b',
  event: '#ef4444',
  concept: '#0ea5e9',
  query: '#a855f7',
  chunk: '#64748b',
  note: '#14b8a6',
};
