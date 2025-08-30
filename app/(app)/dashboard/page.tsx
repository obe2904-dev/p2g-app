// app/(app)/dashboard/page.tsx

// 🧱 Fortæl Next at denne route ALDRIG skal prerenderes
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import NextDynamic from 'next/dynamic';

// VIGTIGT: Denne fil er en Server Component (ingen "use client" her).
// Vi loader client-komponenten (TabAiAssistant) uden SSR.
const TabAiAssistant = NextDynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  { ssr: false, loading: () => null }
);

export default function DashboardPage() {
  return <TabAiAssistant />;
}
