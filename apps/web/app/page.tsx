'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatPanel } from '../components/ChatPanel';
import { MemoryDialog } from '../components/MemoryDialog';
import { NoteDialog } from '../components/NoteDialog';
import { NotePanel } from '../components/NotePanel';
import { Toast, ToastMessage } from '../components/Toast';
import {
  addNoteEntry,
  createNote,
  deleteNote,
  listNotes,
  NewNote,
  NoteRecord,
  streamChat,
} from '../lib/api';

export default function HomePage() {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<'create' | 'entry' | 'memory' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  // Conversation the API is saving this chat to; it builds the AI memory from it.
  const conversationId = useRef<string | null>(null);

  /** Clears the chat; the next message starts a new conversation (and a new memory). */
  const resetChat = useCallback(() => {
    setMessages([]);
    conversationId.current = null;
  }, []);

  const showError = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);

  const refreshNotes = useCallback(async () => {
    try {
      setNotes(await listNotes());
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setLoadingNotes(false);
    }
  }, [showError]);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  const handleSave = useCallback(
    async (input: NewNote): Promise<boolean> => {
      setSaving(true);
      try {
        const note = await createNote(input);
        setNotes((prev) => [note, ...prev]);
        setSelectedId(note.id);
        resetChat();
        return true;
      } catch (error) {
        showError((error as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [resetChat, showError],
  );

  const handleAddEntry = useCallback(
    async (content: string): Promise<boolean> => {
      if (!selectedId) return false;
      setSaving(true);
      try {
        const updated = await addNoteEntry(selectedId, content);
        setNotes((prev) => prev.map((note) => (note.id === updated.id ? updated : note)));
        return true;
      } catch (error) {
        showError((error as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedId, showError],
  );

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteNote(id);
        setNotes((prev) => prev.filter((note) => note.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          resetChat();
        }
      } catch (error) {
        showError((error as Error).message);
      }
    },
    [resetChat, selectedId, showError],
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      resetChat();
    },
    [resetChat, selectedId],
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
        await streamChat(selectedId, text, history, conversationId.current, {
          onConversation: (id) => {
            conversationId.current = id;
          },
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

  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <NotePanel
        notes={notes}
        loading={loadingNotes}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNew={() => setDialog('create')}
        onDelete={handleDelete}
        onOpenMemory={() => setDialog('memory')}
      />
      <ChatPanel
        note={selectedNote}
        onAddEntry={() => setDialog('entry')}
        messages={messages}
        busy={chatBusy}
        onSend={handleSend}
      />
      {dialog === 'create' && (
        <NoteDialog
          mode="create"
          saving={saving}
          onClose={closeDialog}
          onSubmit={handleSave}
          onError={showError}
        />
      )}
      {dialog === 'entry' && selectedNote && (
        <NoteDialog
          mode="entry"
          noteTitle={selectedNote.title}
          noteType={selectedNote.type}
          saving={saving}
          onClose={closeDialog}
          onSubmit={handleAddEntry}
          onError={showError}
        />
      )}
      {dialog === 'memory' && <MemoryDialog note={selectedNote} onClose={closeDialog} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
