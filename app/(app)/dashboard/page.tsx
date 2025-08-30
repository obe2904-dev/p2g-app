// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // tving SSR og undgå SSG/ISR

import dynamic from 'next/dynamic';

// Indlæs client-komponenten uden SSR, så hooks ikke kører ved build
const TabAiAssistant = dynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  { ssr: false }
);

export default function DashboardPage() {
  return (
    <main style={{ padding: 16 }}>
      <TabAiAssistant />
    </main>
  );
}
