export interface RetrievedChunk {
  id: string;
  content: string;
  page: number;
  similarity: number;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY_MESSAGES = 10;

/**
 * Builds the message list for the RAG chat completion.
 *
 * The system message carries the retrieved document excerpts, numbered and
 * labeled with their page, and instructs the model to answer only from
 * that context and to cite pages.
 */
export function buildRagMessages(
  question: string,
  chunks: RetrievedChunk[],
  history: ChatHistoryMessage[] = [],
): ChatCompletionMessage[] {
  const context =
    chunks.length > 0
      ? chunks
          .map((chunk, index) => `[Excerpt ${index + 1} | page ${chunk.page}]\n${chunk.content}`)
          .join('\n\n')
      : 'No relevant excerpts were found in the document.';

  const system = [
    'You are a document assistant. Answer the user question using only the document excerpts below.',
    'Rules:',
    '- If the excerpts do not contain the answer, say so clearly instead of guessing.',
    '- Cite the page numbers you used, in the form (page N).',
    '- Be concise and factual.',
    '',
    'Document excerpts:',
    context,
  ].join('\n');

  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }));

  return [{ role: 'system', content: system }, ...trimmedHistory, { role: 'user', content: question }];
}
