// app/(app)/dashboard/page.tsx
'use client';

import TabAiAssistant from '@/components/dashboard/TabAiAssistant';

// tving alt til runtime (ingen ISR/SSG)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 12 }}>
      <TabAiAssistant />
    </main>
  );
}
