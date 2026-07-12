'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatPanel } from '../components/ChatPanel';
import { DocumentPanel } from '../components/DocumentPanel';
import { Toast, ToastMessage } from '../components/Toast';
import {
  deleteDocument,
  DocumentRecord,
  listDocuments,
  streamChat,
  uploadDocument,
} from '../lib/api';

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);

  const showError = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setLoadingDocuments(false);
    }
  }, [showError]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        showError('Only PDF files are accepted.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('The file exceeds the 10 MB limit.');
        return;
      }
      setUploading(true);
      try {
        const doc = await uploadDocument(file);
        setDocuments((prev) => [doc, ...prev]);
        setSelectedId(doc.id);
        setMessages([]);
      } catch (error) {
        showError((error as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [showError],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id);
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setMessages([]);
        }
      } catch (error) {
        showError((error as Error).message);
      }
    },
    [selectedId, showError],
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setMessages([]);
    },
    [selectedId],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedId) return;
      const history = messages
        .filter((m) => m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: '', streaming: true },
      ]);
      setChatBusy(true);

      const updateAssistant = (updater: (message: ChatMessage) => ChatMessage) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = updater(next[next.length - 1]);
          return next;
        });
      };

      try {
        await streamChat(selectedId, text, history, {
          onSources: (sources) => updateAssistant((m) => ({ ...m, sources })),
          onToken: (token) => updateAssistant((m) => ({ ...m, content: m.content + token })),
          onDone: () => updateAssistant((m) => ({ ...m, streaming: false })),
          onError: (message) => {
            showError(message);
            updateAssistant((m) => ({ ...m, streaming: false }));
          },
        });
      } catch (error) {
        showError((error as Error).message);
        updateAssistant((m) => ({ ...m, streaming: false }));
      } finally {
        setChatBusy(false);
      }
    },
    [messages, selectedId, showError],
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <DocumentPanel
        documents={documents}
        loading={loadingDocuments}
        uploading={uploading}
        selectedId={selectedId}
        onSelect={handleSelect}
        onUpload={handleUpload}
        onDelete={handleDelete}
      />
      <ChatPanel
        documentSelected={selectedId !== null}
        messages={messages}
        busy={chatBusy}
        onSend={handleSend}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
