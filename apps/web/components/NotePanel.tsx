'use client';

import type { NoteRecord } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { BrainIcon } from './MemoryDialog';
import { NOTE_TYPE_COLORS, NoteTypeIcon } from './NoteTypeIcon';

interface NotePanelProps {
  notes: NoteRecord[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenMemory: () => void;
}

export function NotePanel({
  notes,
  loading,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  onOpenMemory,
}: NotePanelProps) {
  const { t, language } = useI18n();

  return (
    <aside className="flex w-full flex-col gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800 md:h-full md:w-80 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">{t.appTitle}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t.appSubtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenMemory}
            aria-label={t.openMemory}
            title={t.memory}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-accent-soft hover:text-accent dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-indigo-400"
          >
            <BrainIcon className="h-5 w-5" />
          </button>
          <LanguageSwitcher />
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 p-4 text-left text-xs text-zinc-500 transition-colors hover:border-accent hover:text-accent dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {t.writeNote}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {t.latestNotes}
        </h2>

        {loading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.noNotes}</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => {
              const color = NOTE_TYPE_COLORS[note.type];
              return (
                <li key={note.id}>
                  <div
                    className={`group flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                      selectedId === note.id
                        ? 'border-accent bg-accent-soft dark:border-indigo-500 dark:bg-zinc-900'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      <NoteTypeIcon type={note.type} className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelect(note.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate font-medium">{note.title}</span>
                      <span className="block truncate text-zinc-400 dark:text-zinc-500">
                        {t.noteTypes[note.type] ?? note.type} &middot;{' '}
                        {t.entriesCount(1 + note.entries.length)} &middot;{' '}
                        {new Date(note.createdAt).toLocaleDateString(language)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={t.deleteNote(note.title)}
                      onClick={() => onDelete(note.id)}
                      className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                    >
                      &times;
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
