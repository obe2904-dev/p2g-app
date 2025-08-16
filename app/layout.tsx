// app/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Post2Grow — Café',
  description: 'Enkel SoMe-hjælp til caféer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background:'#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
