// app/(app)/layout.tsx
import type { ReactNode } from 'react';
import AppSidebar from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body style={{ margin: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            minHeight: '100vh', // hele viewport-højden
            background: '#fff',
          }}
        >
          <aside
            style={{
              position: 'sticky',
              top: 0,
              alignSelf: 'start',
              height: '100vh',
              borderRight: '1px solid #eee',
              padding: 16,
              boxSizing: 'border-box',
              background: '#fff',
            }}
          >
            <AppSidebar />
          </aside>

          <main style={{ padding: 16, boxSizing: 'border-box' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
