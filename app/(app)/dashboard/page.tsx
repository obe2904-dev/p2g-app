// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // behold server-flagget

import nextDynamic from 'next/dynamic';

// Indlæs en *client* komponent uden SSR, så hooks ikke kører ved build
const ClientSmoke = nextDynamic(() => import('./ClientSmoke'), {
  ssr: false,
  loading: () => <main style={{ padding: 16 }}>Loader…</main>,
});

export default function DashboardPage() {
  return <ClientSmoke />;
}
