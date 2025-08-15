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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const industry = cookies().get('industry')?.value;
  return (
    <html lang="da">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 20, maxWidth: 900 }}>
        <header style={{ marginBottom: 24, display:'flex', alignItems:'center', gap:12, justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <h1>Post2Grow — MVP</h1>
            <span style={{ fontSize:12, padding:'2px 8px', border:'1px solid #ddd', borderRadius:999 }}>
              Branche: {label(industry)}
            </span>
          </div>
         <nav style={{ display: 'flex', gap: 12 }}>
          <a href="/">Forside</a>
          <a href="/signup">Tilmeld</a>
          <a href="/login">Log ind</a>
          <a href="/welcome">Velkommen</a>
          <a href="/posts">Dine opslag</a>
          <a href="/posts/new">Nyt opslag</a>
          <a href="/performance">Effekt</a> {/* eller “Resultater” hvis du vil */}
          <a href="/pricing">Priser</a> {/* <-- ændret fra "Pricing" */}
        </nav>

        </header>
        {children}
      </body>
    </html>
  );
}
