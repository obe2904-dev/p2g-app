import { cookies } from 'next/headers';

export const metadata = { title: 'Post2Grow', description: 'MVP' };

function label(industry: string | undefined) {
  switch (industry) {
    case 'frisor': return 'Frisør';
    case 'fysio': return 'Fysio';
    default: return 'Café';
  }
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
          <a href="/signup">Signup</a>
          <a href="/login">Login</a>
          <a href="/welcome">Welcome</a>
          <a href="/posts">Dine opslag</a>
          <a href="/posts/new">Nyt opslag</a>
          <a href="/performance">Performance</a>
          <a href="/pricing">Pricing</a>
        </nav>

        </header>
        {children}
      </body>
    </html>
  );
}
