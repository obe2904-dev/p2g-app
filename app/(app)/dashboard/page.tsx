export const dynamic = 'force-dynamic';

import dynamic from 'next/dynamic';
const ClientSmoke = dynamic(() => import('./ClientSmoke'), { ssr: false, loading: () => <main style={{padding:16}}>Loader…</main> });

export default function DashboardPage() {
  return <ClientSmoke />;
}
