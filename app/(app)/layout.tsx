// app/(app)/layout.tsx
import type { ReactNode } from 'react';
import AppSidebar from '@/components/AppSidebar';
import TopBar from '@/components/TopBar';

const SIDEBAR_W = 260;
const HEADER_H = 64;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* FAST (fixed) sidebar med egen scroll */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: SIDEBAR_W,
          height: '100vh',
          borderRight: '1px solid #eee',
          background: '#fff',
          padding: 16,
          boxSizing: 'border-box',
          overflowY: 'auto',
          zIndex: 1000,
        }}
      >
        <AppSidebar />
      </aside>

      {/* FAST (fixed) topbar med navn, plan, Profil, Log ud */}
      <header
        style={{
          position: 'fixed',
          left: SIDEBAR_W,
          right: 0,
          top: 0,
          height: HEADER_H,
          borderBottom: '1px solid #eee',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          boxSizing: 'border-box',
          zIndex: 900,
        }}
      >
        <TopBar />
      </header>

      {/* Hovedindhold – plads til sidebar + topbar */}
      <main
        style={{
          marginLeft: SIDEBAR_W,
          padding: 16,
          paddingTop: HEADER_H + 16,
          minHeight: '100vh',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {children}

      </main>
    </div>
  );
}
