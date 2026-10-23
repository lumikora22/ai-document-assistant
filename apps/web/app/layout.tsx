import type { Metadata } from 'next';
import { LanguageProvider } from '../lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'bookmarkk',
  description: 'Visualização de anotações de histórias  ultilizando mecanismo de Rag.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
