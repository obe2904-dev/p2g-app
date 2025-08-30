// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // undgå SSG/ISR på denne route

import NextDynamic from 'next/dynamic';

// Indlæs client-komponenten uden SSR (forhindrer hooks under build)
const TabAiAssistant = NextDynamic(
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
