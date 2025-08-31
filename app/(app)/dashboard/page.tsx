// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // undgå SSG/ISR på denne route

import nextDynamic from 'next/dynamic';

// Indlæs selve dashboardet som client-komponent
const TabAiAssistant = nextDynamic(
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
  return <TabAiAssistant />;
}
