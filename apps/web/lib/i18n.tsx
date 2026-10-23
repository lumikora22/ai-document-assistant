'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { NoteType } from './api';
import type { GraphNodeKind, GraphView } from './memory';

export type Language = 'pt-BR' | 'en-GB';

const STORAGE_KEY = 'language';

const translations = {
  'pt-BR': {
    appTitle: 'Bookmarkk',
    appSubtitle: 'Anote suas histórias e converse sobre elas.',
    writeNote: 'Digite sua anotação...',
    newNote: 'Nova anotação',
    closeDialog: 'Fechar',
    titleLabel: 'Título',
    titlePlaceholder: 'Título da anotação',
    typeLabel: 'Tipo',
    contentLabel: 'Anotação',
    contentPlaceholder: 'Escreva aqui o que você quer lembrar...',
    save: 'Salvar',
    saving: 'Salvando...',
    cancel: 'Cancelar',
    latestNotes: 'Últimas anotações',
    noNotes: 'Nenhuma anotação ainda. Escreva a primeira acima.',
    deleteNote: (title: string) => `Excluir ${title}`,
    noteTypes: {
      game_story: 'História de jogo',
      study: 'Estudo',
      book: 'Livro',
      movie_series: 'Filme / Série',
      work: 'Trabalho',
      personal: 'Pessoal',
      other: 'Outro',
    } as Record<NoteType, string>,
    addEntry: 'Adicionar anotação',
    addEntryTo: (title: string) => `Nova anotação em “${title}”`,
    entriesCount: (count: number) => (count === 1 ? '1 anotação' : `${count} anotações`),
    readNotes: 'Ler anotações',
    hideNotes: 'Recolher anotações',
    titleRequired: 'Informe um título para a anotação.',
    contentRequired: 'Escreva o conteúdo da anotação.',
    selectToStart: 'Selecione ou crie uma anotação à esquerda para começar a conversar.',
    askAnything: 'Pergunte qualquer coisa sobre esta anotação.',
    assistantThinking: 'O assistente está pensando',
    askPlaceholder: 'Pergunte sobre esta anotação...',
    selectFirst: 'Selecione uma anotação primeiro',
    chatMessage: 'Mensagem do chat',
    thinking: 'Pensando...',
    send: 'Enviar',
    hideSources: 'Ocultar trechos',
    sources: (count: number) => `Trechos usados (${count})`,
    excerpt: (index: number) => `Trecho ${index}`,
    match: (percent: string) => `${percent}% de correspondência`,
    dismiss: 'Fechar notificação',
    language: 'Idioma',
    memory: 'Memória',
    openMemory: 'Abrir memória',
    memoryConversations: 'Memória da IA',
    memoryGraph: 'Grafos de conversa',
    graphViews: { entities: 'Entidades', rag: 'RAG' } as Record<GraphView, string>,
    memoryScopeAll: 'Memória de todas as notas',
    memoryScopeNote: (title: string) => `Memória da nota “${title}”`,
    memoryThisNote: 'Esta nota',
    memoryAllNotes: 'Todas',
    memoryRefresh: 'Atualizar',
    memoryLoading: 'Carregando…',
    memoryEmpty: 'Nenhuma memória ainda. Converse com a IA sobre uma nota: a memória é criada alguns segundos depois de cada resposta.',
    graphEmpty: 'O grafo aparece depois que você conversar com a IA sobre a nota.',
    messagesCount: (count: number) => (count === 1 ? '1 mensagem' : `${count} mensagens`),
    graphHint: 'Clique em um nó para ver as conexões.',
    connectionsOf: (label: string) => `Conexões de ${label}`,
    graphNodeKinds: {
      character: 'Personagem',
      place: 'Lugar',
      item: 'Item',
      event: 'Evento',
      concept: 'Conceito',
      query: 'Pergunta',
      chunk: 'Trecho',
      note: 'Anotação',
    } as Record<GraphNodeKind, string>,
  },
  'en-GB': {
    appTitle: 'Bookmarkk',
    appSubtitle: 'Write down your stories and chat about them.',
    writeNote: 'Type your note...',
    newNote: 'New note',
    closeDialog: 'Close',
    titleLabel: 'Title',
    titlePlaceholder: 'Note title',
    typeLabel: 'Type',
    contentLabel: 'Note',
    contentPlaceholder: 'Write down what you want to remember...',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    latestNotes: 'Latest notes',
    noNotes: 'No notes yet. Write your first one above.',
    deleteNote: (title: string) => `Delete ${title}`,
    noteTypes: {
      game_story: 'Game story',
      study: 'Study',
      book: 'Book',
      movie_series: 'Film / Series',
      work: 'Work',
      personal: 'Personal',
      other: 'Other',
    } as Record<NoteType, string>,
    addEntry: 'Add note',
    addEntryTo: (title: string) => `New note in “${title}”`,
    entriesCount: (count: number) => (count === 1 ? '1 note' : `${count} notes`),
    readNotes: 'Read notes',
    hideNotes: 'Hide notes',
    titleRequired: 'Please give the note a title.',
    contentRequired: 'Please write the note content.',
    selectToStart: 'Select or create a note on the left to start chatting.',
    askAnything: 'Ask anything about this note.',
    assistantThinking: 'Assistant is thinking',
    askPlaceholder: 'Ask about this note...',
    selectFirst: 'Select a note first',
    chatMessage: 'Chat message',
    thinking: 'Thinking...',
    send: 'Send',
    hideSources: 'Hide excerpts',
    sources: (count: number) => `Excerpts used (${count})`,
    excerpt: (index: number) => `Excerpt ${index}`,
    match: (percent: string) => `${percent}% match`,
    dismiss: 'Dismiss notification',
    language: 'Language',
    memory: 'Memory',
    openMemory: 'Open memory',
    memoryConversations: 'AI memory',
    memoryGraph: 'Conversation graphs',
    graphViews: { entities: 'Entities', rag: 'RAG' } as Record<GraphView, string>,
    memoryScopeAll: 'Memory of every note',
    memoryScopeNote: (title: string) => `Memory of the note “${title}”`,
    memoryThisNote: 'This note',
    memoryAllNotes: 'All',
    memoryRefresh: 'Refresh',
    memoryLoading: 'Loading…',
    memoryEmpty: 'No memories yet. Chat with the AI about a note: the memory is created a few seconds after each answer.',
    graphEmpty: 'The graph appears after you chat with the AI about the note.',
    messagesCount: (count: number) => (count === 1 ? '1 message' : `${count} messages`),
    graphHint: 'Click a node to see its connections.',
    connectionsOf: (label: string) => `Connections of ${label}`,
    graphNodeKinds: {
      character: 'Character',
      place: 'Place',
      item: 'Item',
      event: 'Event',
      concept: 'Concept',
      query: 'Question',
      chunk: 'Chunk',
      note: 'Note',
    } as Record<GraphNodeKind, string>,
  },
};

export type Translations = (typeof translations)['en-GB'];

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt-BR');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'pt-BR' || stored === 'en-GB') setLanguageState(stored);
    } catch {
      // Storage unavailable; keep the default language.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable; the choice lasts for this session only.
    }
  }, []);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within a LanguageProvider');
  return context;
}
