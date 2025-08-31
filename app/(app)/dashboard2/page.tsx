// app/(app)/dashboard2/page.tsx
export const dynamic = 'force-dynamic'; // undgå SSG/ISR så data & quotas er friske

import dynamic from 'next/dynamic';

// Vi genbruger de eksisterende, “gamle” brikker:
// - HeroRow: topkort med counts/org-info
// - TabAiAssistant: platformvalg → 3 forslag → tekst+foto (to kolonner) → gem/kopier
// - TabPlanning: kalenderkort (pt. placeholder i repoet)
const HeroRow = dynamic(() => import('@/components/dashboard/HeroRow'), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 16 }}>
      <p>Loader…</p>
    </main>
  ),
});

const AIAssistant = dynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  {
    ssr: false,
    loading: () => (
      <main style={{ padding: 16 }}>
        <p>Loader AI-assistent…</p>
      </main>
    ),
  }
);

const Planning = dynamic(() => import('@/components/dashboard/TabPlanning'), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 16 }}>
      <p>Loader planlægning…</p>
    </main>
  ),
});

export default function Dashboard2Page() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række: KPI/Org snapshot */}
      <HeroRow />

      {/* Hovedflow: platformvalg → 3 forslag → tekst+foto (to kolonner inde i komponenten) */}
      <AIAssistant />

      {/* Kalender (pt. placeholder i repoet, men UI’et er på plads) */}
      <Planning />
    </div>
  );
}
