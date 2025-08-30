// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // undgå SSG/ISR på denne route

import dynamic from 'next/dynamic';

// Indlæs client-komponenten uden SSR, så der ikke køres hooks ved build
const TabAiAssistant = dynamic(
  () => import('@/components/dashboard/TabAiAssistant'),
  { ssr: false }
);

export default function DashboardPage() {
  return <TabAiAssistant />;
}
