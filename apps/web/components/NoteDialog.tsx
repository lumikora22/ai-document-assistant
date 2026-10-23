'use client';

import { FormEvent, useEffect, useState } from 'react';
import { NewNote, NOTE_TYPES, NoteType } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { NOTE_TYPE_COLORS, NoteTypeIcon } from './NoteTypeIcon';

type NoteDialogProps =
  | {
      mode: 'create';
      saving: boolean;
      onClose: () => void;
      onSubmit: (note: NewNote) => Promise<boolean>;
      onError: (message: string) => void;
    }
  | {
      mode: 'entry';
      /** Title and type of the note the entry is added to. */
      noteTitle: string;
      noteType: NoteType;
      saving: boolean;
      onClose: () => void;
      onSubmit: (content: string) => Promise<boolean>;
      onError: (message: string) => void;
    };

/** Pop-up used both to write a new note and to add an annotation to an existing one. */
export function NoteDialog(props: NoteDialogProps) {
  const { mode, saving, onClose, onError } = props;
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NoteType>('game_story');
  const [content, setContent] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  const activeType = mode === 'entry' ? props.noteType : type;
  const color = NOTE_TYPE_COLORS[activeType];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (mode === 'create') {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return onError(t.titleRequired);
      if (!trimmedContent) return onError(t.contentRequired);
      const saved = await props.onSubmit({ title: trimmedTitle, type, content: trimmedContent });
      if (saved) onClose();
    } else {
      if (!trimmedContent) return onError(t.contentRequired);
      const saved = await props.onSubmit(trimmedContent);
      if (saved) onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-dialog-title"
        className="animate-dialog-in flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Colour strip that follows the selected type. */}
        <div className="h-1.5 transition-colors" style={{ backgroundColor: color }} />

        <div className="flex items-center gap-3 px-6 pt-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <NoteTypeIcon type={activeType} className="h-5 w-5" />
          </span>
          <h2 id="note-dialog-title" className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {mode === 'create' ? t.newNote : t.addEntryTo(props.noteTitle)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t.closeDialog}
            className="rounded-lg p-1 text-2xl leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            &times;
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
          {mode === 'create' && (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                aria-label={t.titleLabel}
                maxLength={200}
                disabled={saving}
                autoFocus
                className="w-full border-b-2 border-zinc-200 bg-transparent pb-2 text-3xl font-bold tracking-tight outline-none transition-colors placeholder:text-zinc-300 focus:border-accent disabled:opacity-50 dark:border-zinc-700 dark:placeholder:text-zinc-600 dark:focus:border-indigo-400"
              />

              <fieldset>
                <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {t.typeLabel}
                </legend>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {NOTE_TYPES.map((value) => {
                    const selected = value === type;
                    const typeColor = NOTE_TYPE_COLORS[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        aria-pressed={selected}
                        disabled={saving}
                        title={t.noteTypes[value]}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-1 py-2.5 text-center text-[10px] font-medium leading-tight transition-all disabled:opacity-50 ${
                          selected
                            ? 'scale-105 shadow-md'
                            : 'border-zinc-200 text-zinc-500 hover:-translate-y-0.5 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                        }`}
                        style={
                          selected
                            ? { borderColor: typeColor, backgroundColor: `${typeColor}1f`, color: typeColor }
                            : undefined
                        }
                      >
                        <NoteTypeIcon type={value} className="h-6 w-6" />
                        <span>{t.noteTypes[value]}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.contentPlaceholder}
            aria-label={t.contentLabel}
            rows={8}
            disabled={saving}
            autoFocus={mode === 'entry'}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-accent focus:bg-white disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-indigo-400"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
              </svg>
            )}
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
