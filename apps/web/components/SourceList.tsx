'use client';

import { useState } from 'react';
import type { ChatSource } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface SourceListProps {
  sources: ChatSource[];
}

export function SourceList({ sources }: SourceListProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  if (sources.length === 0) return null;

  return (
    <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-xs font-medium text-accent hover:underline dark:text-indigo-400"
      >
        {open ? t.hideSources : t.sources(sources.length)}
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {sources.map((source, index) => (
            <li
              key={source.id}
              className="rounded-md bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <div className="mb-1 flex items-center justify-between font-medium text-zinc-500 dark:text-zinc-400">
                <span>{t.excerpt(index + 1)}</span>
                <span>{t.match(Math.max(0, Math.min(1, source.similarity) * 100).toFixed(0))}</span>
              </div>
              <p className="line-clamp-4 break-words">{source.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
