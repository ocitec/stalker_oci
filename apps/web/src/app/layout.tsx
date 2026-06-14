import type { Metadata } from 'next';
import { Toaster } from 'sonner';
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
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#131929',
                border: '1px solid #2A3A5C',
                color: '#E8EDF8',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
