import type { ConversationMemory, GraphView, MemoryGraph } from './memory';

// Same-origin path proxied to the NestJS API by next.config.mjs. Set
// NEXT_PUBLIC_API_URL only to bypass the proxy and call the API directly.
const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');

export const NOTE_TYPES = [
  'game_story',
  'study',
  'book',
  'movie_series',
  'work',
  'personal',
  'other',
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  title: string;
  type: NoteType;
  content: string;
  entries: NoteEntry[];
  createdAt: string;
}

export interface NewNote {
  title: string;
  type: NoteType;
  content: string;
}

export interface ChatSource {
  id: string;
  content: string;
  similarity: number;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = body.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  } catch {
    // Fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

export async function listNotes(): Promise<NoteRecord[]> {
  const response = await fetch(`${API_URL}/notes`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function createNote(note: NewNote): Promise<NoteRecord> {
  const response = await fetch(`${API_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function addNoteEntry(id: string, content: string): Promise<NoteRecord> {
  const response = await fetch(`${API_URL}/notes/${id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function deleteNote(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await parseError(response));
}

/** Memories built from past conversations; limited to one note when noteId is given. */
export async function listMemories(noteId?: string): Promise<ConversationMemory[]> {
  const query = noteId ? `?noteId=${encodeURIComponent(noteId)}` : '';
  const response = await fetch(`${API_URL}/memory${query}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

/** One of the conversation graphs (entities or RAG), optionally for a single note. */
export async function getMemoryGraph(view: GraphView, noteId?: string): Promise<MemoryGraph> {
  const query = noteId ? `?noteId=${encodeURIComponent(noteId)}` : '';
  const response = await fetch(`${API_URL}/memory/graph/${view}${query}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export interface ChatStreamHandlers {
  /** Id of the conversation the API saved the exchange to; send it back with the next message. */
  onConversation: (conversationId: string) => void;
  onSources: (sources: ChatSource[]) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Sends a chat request and consumes the SSE response stream.
 *
 * The API emits: one "conversation" event, one "sources" event, a series of
 * "token" events, and a final "done" event. Server-side failures mid-stream
 * arrive as "error".
 */
export async function streamChat(
  noteId: string,
  message: string,
  history: ChatHistoryMessage[],
  conversationId: string | null,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteId, message, history, conversationId }),
  });

  if (!response.ok || !response.body) {
    handlers.onError(await parseError(response));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processBlock = (block: string): void => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    const data = dataLines.join('\n');

    if (event === 'conversation') {
      handlers.onConversation((JSON.parse(data) as { id: string }).id);
    } else if (event === 'sources') {
      handlers.onSources(JSON.parse(data) as ChatSource[]);
    } else if (event === 'token') {
      handlers.onToken((JSON.parse(data) as { content: string }).content);
    } else if (event === 'done') {
      handlers.onDone();
    } else if (event === 'error') {
      handlers.onError((JSON.parse(data) as { message: string }).message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      processBlock(block);
      separatorIndex = buffer.indexOf('\n\n');
    }
  }
}
