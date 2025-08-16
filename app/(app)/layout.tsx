// app/(app)/layout.tsx
import type { ReactNode } from 'react';
import RequireAuth from '@/components/RequireAuth';
import AppSidebar from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fff' }}>
        <RequireAuth>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Fast venstrekolonne */}
            <aside
              style={{
                width: 240,
                borderRight: '1px solid #eee',
                padding: '16px 12px',
                position: 'sticky',
                top: 0,
                alignSelf: 'flex-start',
                height: '100vh',
                overflowY: 'auto'
              }}
            >
              <AppSidebar />
            </aside>

            {/* Hovedindhold (scroller) */}
            <div style={{ flex: 1, padding: '16px 20px', maxWidth: 1200, margin: '0 auto' }}>
              {children}
            </div>
          </div>
        </RequireAuth>
      </body>
    </html>
  );
}
