'use client';

export default function PerformancePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2>Performance</h2>
      <p>Ruten virker ✅</p>

      <p style={{ marginTop: 12 }}>
        Her kommer KPI-overblikket. Indtil videre er dette en smoke-test, så vi er sikre på,
        at siden loader uden fejl. 
      </p>

      <div style={{ marginTop: 16 }}>
        <a href="/posts">← Tilbage til Dine opslag</a>
      </div>
    </main>
  );
}
