import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Document Assistant',
  description: 'Upload a PDF and chat with an AI about its content, with source citations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
