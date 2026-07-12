const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface DocumentRecord {
  id: string;
  filename: string;
  pages: number;
  chunks: number;
  createdAt: string;
}

export interface ChatSource {
  id: string;
  page: number;
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

export async function listDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${API_URL}/documents`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_URL}/documents`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/documents/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await parseError(response));
}

export interface ChatStreamHandlers {
  onSources: (sources: ChatSource[]) => void;
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Sends a chat request and consumes the SSE response stream.
 *
 * The API emits: one "sources" event, a series of "token" events, and a
 * final "done" event. Server-side failures mid-stream arrive as "error".
 */
export async function streamChat(
  documentId: string,
  message: string,
  history: ChatHistoryMessage[],
  handlers: ChatStreamHandlers,
): Promise<void> {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, message, history }),
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

    if (event === 'sources') {
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
