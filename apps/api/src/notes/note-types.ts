/** Categories a note can belong to. Labels are translated on the frontend. */
export const NOTE_TYPES = [
  'game_story',
  'study',
  'book',
  'movie_series',
  'work',
  'personal',
  'other',
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

/** Nomes dos tipos usados ao descrever a nota para o modelo nos prompts em pt-BR. */
export const NOTE_TYPE_LABELS_PT: Record<NoteType, string> = {
  game_story: 'história de jogo',
  study: 'estudo',
  book: 'livro',
  movie_series: 'filme ou série',
  work: 'trabalho',
  personal: 'pessoal',
  other: 'outro',
};

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && (NOTE_TYPES as readonly string[]).includes(value);
}
