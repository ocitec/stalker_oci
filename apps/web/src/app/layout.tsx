import type { Metadata } from 'next';
import { Providers } from '@/components/layout/Providers';
// @ts-ignore: side-effect import for global CSS
import './globals.css';

import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Stalker v1 — Receivables Control System',
  description: 'Cashflow intelligence platform. Reduce DSO, enforce payment discipline.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
