// app/(app)/dashboard2/page.tsx
export const dynamic = 'force-dynamic'; // ingen SSG/ISR
// (ingen 'use client' her)

import NextDynamic from 'next/dynamic';

const Dashboard2Client = NextDynamic(() => import('./Dashboard2Client'), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 16 }}>
      <p>Loader…</p>
    </main>
  ),
});

export default function Page() {
  return <Dashboard2Client />;
}
