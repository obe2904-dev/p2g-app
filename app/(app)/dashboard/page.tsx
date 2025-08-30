// app/(app)/dashboard/page.tsx
'use client';

import dynamic from 'next/dynamic';

// Indlæs AI-assistenten kun i browseren (ikke på serveren)
const TabAiAssistant = dynamic(
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
