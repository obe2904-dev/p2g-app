// app/layout.tsx
import './globals.css';
import type { ReactNode } from 'react';
import Header from '@/components/Header';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body>
        <Header />
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '16px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
