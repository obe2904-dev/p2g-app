// app/(app)/dashboard/page.tsx

// Tving denne route til at være dynamisk (ingen SSG/ISR)
export const dynamic = 'force-dynamic';

import NextDynamic from 'next/dynamic';

// Indlæs client-komponenten uden SSR, så hooks først kører i browseren
const TabAiAssistant = NextDynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  { ssr: false, loading: () => <main><p>Indlæser…</p></main> }
);

export default function DashboardPage() {
  return <TabAiAssistant />;
}
