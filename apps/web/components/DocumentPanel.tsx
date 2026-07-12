'use client';

import { useCallback, useRef, useState } from 'react';
import type { DocumentRecord } from '../lib/api';

interface DocumentPanelProps {
  documents: DocumentRecord[];
  loading: boolean;
  uploading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
}

export function DocumentPanel({
  documents,
  loading,
  uploading,
  selectedId,
  onSelect,
  onUpload,
  onDelete,
}: DocumentPanelProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onUpload(file);
    },
    [onUpload],
  );

  return (
    <aside className="flex w-full flex-col gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800 md:h-full md:w-72 md:shrink-0 md:border-b-0 md:border-r">
      <div>
        <h1 className="text-sm font-semibold tracking-wide">AI Document Assistant</h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Upload a PDF and chat about its content.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${
          dragging
            ? 'border-accent bg-accent-soft dark:bg-zinc-900'
            : 'border-zinc-300 hover:border-accent dark:border-zinc-700'
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Indexing document...
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            Drop a PDF here or <span className="font-medium text-accent dark:text-indigo-400">browse</span>
            <span className="mt-1 block text-[10px]">Max 10 MB</span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Documents
        </h2>

        {loading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            No documents yet. Upload a PDF to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <div
                  className={`group flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
                    selectedId === doc.id
                      ? 'border-accent bg-accent-soft dark:border-indigo-500 dark:bg-zinc-900'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(doc.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate font-medium">{doc.filename}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {doc.pages} pages &middot; {doc.chunks} chunks
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${doc.filename}`}
                    onClick={() => onDelete(doc.id)}
                    className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    &times;
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
