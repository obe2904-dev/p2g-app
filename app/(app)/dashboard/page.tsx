// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // undgå SSG/ISR

import nextDynamic from 'next/dynamic';

// <- BRUG DEN KOMPONENT DU ALLEREDE HAR
const ClientDashboard = nextDynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  {
    ssr: false,
    loading: () => (
      <main style={{ padding: 16 }}>
        <p>Loader…</p>
      </main>
    ),
  }
);

export default function DashboardPage() {
  return <ClientDashboard />;
}
