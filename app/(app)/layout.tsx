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
<style jsx global>{`
  :root{
    /* Responsive font-sizes (clamp = skalerer mellem min..max) */
    --fs-12: clamp(11px, 1.1vw, 12px);
    --fs-13: clamp(12px, 1.2vw, 13px);
    --fs-16: clamp(14px, 1.6vw, 16px);
    --fs-24: clamp(18px, 2.4vw, 24px);

    /* Cards */
    --radius: 12px;
    --card-pad: clamp(12px, 2vw, 16px);
  }

  /* Generiske card-klasser (genbrug til alle dashboard-kort fremover) */
  .card{
    border: 1px solid #eee;
    border-radius: var(--radius);
    padding: var(--card-pad);
    background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    min-width: 220px;            /* undgå at kort bliver for smalle */
  }
  .card-title{ font-size: var(--fs-12); color:#666; margin-bottom: 6px; }
  .card-big{ font-size: var(--fs-24); font-weight: 700; line-height: 1.1; margin-bottom: 6px; }
  .card-sub{ font-size: var(--fs-13); color:#555; }

  /* Øverste række med de tre kort */
  .dash-row{
    display: grid;
    gap: 12px;
    grid-template-columns: 1.1fr 1.1fr 1.8fr;  /* to små + én dobbelt */
    align-items: stretch;
  }

  /* Når skærmen bliver smallere: 2 kolonner + det store kort på ny linje */
  @media (max-width: 1100px){
    .dash-row{ grid-template-columns: minmax(220px,1fr) minmax(220px,1fr); }
    .dash-row > .card:last-child { grid-column: 1 / -1; }
  }

  /* Meget smalle skærme: én kolonne */
  @media (max-width: 520px){
    .dash-row{ grid-template-columns: 1fr; }
  }
`}</style>
      </main>
    </div>
  );
}
