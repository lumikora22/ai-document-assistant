'use client';

import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <div className="flex items-start gap-2">
        <span className="flex-1 break-words">{toast.text}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 font-medium opacity-60 hover:opacity-100"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
