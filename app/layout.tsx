// app/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Post2Grow — Café',
  description: 'Enkel SoMe-hjælp til caféer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fff' }}>
        {/* Topbar / navigation */}
        <header style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #eee', zIndex: 10 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <a href="/" style={{ fontWeight: 700, textDecoration: 'none', color: '#111' }}>Post2Grow</a>
            <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/posts/new">Nyt opslag</a>
              <a href="/posts">Dine opslag</a>
              <a href="/performance">Performance</a>
              <a href="/pricing">Pricing</a>
              <a href="/login">Login</a>
            </nav>
          </div>
        </header>

        {/* Sideindhold */}
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
