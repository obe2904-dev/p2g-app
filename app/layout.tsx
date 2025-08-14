export const metadata = { title: 'Post2Grow', description: 'MVP' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 20, maxWidth: 820 }}>
        <header style={{ marginBottom: 24 }}>
          <h1>Post2Grow — MVP</h1>
          <nav style={{ display: 'flex', gap: 12 }}>
  <a href="/">Forside</a>
  <a href="/login">Login</a>
  <a href="/welcome">Welcome</a>
</nav>
        </header>
        {children}
      </body>
    </html>
  );
}
