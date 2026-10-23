'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatSource, NoteRecord } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { NoteDetails } from './NoteDetails';
import { SourceList } from './SourceList';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  streaming?: boolean;
}

interface ChatPanelProps {
  note: NoteRecord | null;
  onAddEntry: () => void;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (message: string) => void;
}

export function ChatPanel({ note, onAddEntry, messages, busy, onSend }: ChatPanelProps) {
  const noteSelected = note !== null;
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy || !noteSelected) return;
    setInput('');
    onSend(trimmed);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {note && <NoteDetails note={note} onAddEntry={onAddEntry} />}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!noteSelected ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs text-center text-sm text-zinc-400 dark:text-zinc-500">
              {t.selectToStart}
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs text-center text-sm text-zinc-400 dark:text-zinc-500">
              {t.askAnything}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <>
                      {message.content ? (
                        <div className="markdown-body break-words">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : message.streaming ? (
                        <span className="flex gap-1 py-1" aria-label={t.assistantThinking}>
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:240ms]" />
                        </span>
                      ) : null}
                      {!message.streaming && message.sources && <SourceList sources={message.sources} />}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{message.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={noteSelected ? t.askPlaceholder : t.selectFirst}
            disabled={!noteSelected || busy}
            aria-label={t.chatMessage}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!noteSelected || busy || input.trim().length === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? t.thinking : t.send}
          </button>
        </div>
      </form>
    </section>
  );
}
