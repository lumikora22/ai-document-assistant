'use client';

import { Language, useI18n } from '../lib/i18n';

function BrazilFlag() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 rounded-sm" aria-hidden>
      <rect width="20" height="14" fill="#009c3b" />
      <polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#ffdf00" />
      <circle cx="10" cy="7" r="3.3" fill="#002776" />
    </svg>
  );
}

function UnitedKingdomFlag() {
  return (
    <svg viewBox="0 0 60 30" className="h-3.5 w-5 rounded-sm" preserveAspectRatio="none" aria-hidden>
      <clipPath id="uk-flag-diagonals">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#uk-flag-diagonals)"
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const OPTIONS: { value: Language; label: string; Flag: () => React.JSX.Element }[] = [
  { value: 'pt-BR', label: 'Português (Brasil)', Flag: BrazilFlag },
  { value: 'en-GB', label: 'English (UK)', Flag: UnitedKingdomFlag },
];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div role="group" aria-label={t.language} className="flex gap-1">
      {OPTIONS.map(({ value, label, Flag }) => (
        <button
          key={value}
          type="button"
          onClick={() => setLanguage(value)}
          aria-pressed={language === value}
          aria-label={label}
          title={label}
          className={`rounded-md border p-1 transition-colors ${
            language === value
              ? 'border-accent bg-accent-soft dark:border-indigo-500 dark:bg-zinc-900'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Flag />
        </button>
      ))}
    </div>
  );
}
