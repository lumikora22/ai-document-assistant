import type { NoteType } from '../lib/api';

/** Accent colour for each note type, used on icons and badges. */
export const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  game_story: '#4f7bd9',
  study: '#16a34a',
  book: '#dc2626',
  movie_series: '#9333ea',
  work: '#d97706',
  personal: '#db2777',
  other: '#64748b',
};

const PATHS: Record<NoteType, React.ReactNode> = {
  game_story: (
    <>
      <path d="M6 11h4M8 9v4" />
      <circle cx="15" cy="12" r="0.6" fill="currentColor" />
      <circle cx="18" cy="10" r="0.6" fill="currentColor" />
      <path d="M17.3 5H6.7a4 4 0 0 0-3.96 3.44l-.9 6.3A2.6 2.6 0 0 0 4.4 17.7c.7 0 1.37-.3 1.84-.8L8.8 14h6.4l2.56 2.9c.47.51 1.14.8 1.84.8a2.6 2.6 0 0 0 2.56-2.96l-.9-6.3A4 4 0 0 0 17.3 5Z" />
    </>
  ),
  study: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 2.5 9 2.5 12 0v-5" />
      <path d="M22 10v6" />
    </>
  ),
  book: (
    <>
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z" />
    </>
  ),
  movie_series: (
    <>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M2 12h20" />
    </>
  ),
  work: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" />
    </>
  ),
  personal: (
    <path d="M19 14c1.5-1.46 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  other: (
    <>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5Z" />
      <path d="M16 8 2 22M17.5 15H9" />
    </>
  ),
};

interface NoteTypeIconProps {
  type: NoteType;
  className?: string;
}

export function NoteTypeIcon({ type, className = 'h-5 w-5' }: NoteTypeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[type] ?? PATHS.other}
    </svg>
  );
}
