// app/(app)/layout.tsx
import type { ReactNode } from 'react';
import AppSidebar from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* FAST (fixed) sidebar med egen scroll */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 260,
          height: '100vh',
          borderRight: '1px solid #eee',
          background: '#fff',
          padding: 16,
          boxSizing: 'border-box',
          overflowY: 'auto', // <-- gør at du kan scrolle i sidebaren
        }}
      >
        <AppSidebar />
      </aside>

      {/* Hovedindhold: fylder resten og scroller separat */}
      <main
        style={{
          marginLeft: 260,          // plads til sidebaren
          minHeight: '100vh',
          padding: 16,
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {children}
      </main>
    </div>
  );
}
