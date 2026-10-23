'use client';

import { useState } from 'react';
import type { NoteRecord } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { NOTE_TYPE_COLORS, NoteTypeIcon } from './NoteTypeIcon';

interface NoteDetailsProps {
  note: NoteRecord;
  onAddEntry: () => void;
}

/** Header above the chat: the selected note, its annotations and a way to add more. */
export function NoteDetails({ note, onAddEntry }: NoteDetailsProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const color = NOTE_TYPE_COLORS[note.type];
  const entries = [{ id: note.id, content: note.content, createdAt: note.createdAt }, ...note.entries];

  return (
    <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <NoteTypeIcon type={note.type} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{note.title}</h2>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {t.noteTypes[note.type] ?? note.type} &middot; {t.entriesCount(entries.length)} &middot;{' '}
              <span className="font-medium text-accent dark:text-indigo-400">
                {open ? t.hideNotes : t.readNotes}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={onAddEntry}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <span className="text-base leading-none">+</span>
            {t.addEntry}
          </button>
        </div>

        {open && (
          <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border-l-4 bg-white p-3 text-sm dark:bg-zinc-900"
                style={{ borderLeftColor: color }}
              >
                <p className="whitespace-pre-wrap break-words">{entry.content}</p>
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {new Date(entry.createdAt).toLocaleString(language)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
