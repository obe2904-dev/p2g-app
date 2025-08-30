// app/(app)/dashboard/page.tsx

export const dynamic = 'force-dynamic'; // tving SSR og undgå SSG/ISR på denne route

import nextDynamic from 'next/dynamic';

// Indlæs client-komponenten uden SSR, så hooks ikke kører ved build
const TabAiAssistant = nextDynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  {
    ssr: false,
    loading: () => <main style={{ padding: 16 }}><p>Loader…</p></main>,
  }
);

export default function DashboardPage() {
  return <TabAiAssistant />;
}
