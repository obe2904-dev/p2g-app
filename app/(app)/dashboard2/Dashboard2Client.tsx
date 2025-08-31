// app/(app)/dashboard2/Dashboard2Client.tsx
'use client';

import HeroRow from '@/components/dashboard/HeroRow';
import TabAiAssistant from '@/components/dashboard/TabAiAssistant';
import TabPlanning from '@/components/dashboard/TabPlanning';
import { useCounts } from '@/components/dashboard/useCounts';
import { useOrgSnapshot } from '@/components/dashboard/useOrgSnapshot';

export default function Dashboard2Client() {
  const { counts, loading, bumpAiTextLocal } = useCounts();
  const org = useOrgSnapshot();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række: KPI/Org snapshot */}
      <HeroRow counts={counts} loading={loading} org={org} />

      {/* Guided flow: platformvalg → 3 forslag → tekst+foto */}
      <TabAiAssistant onAiTextUse={() => bumpAiTextLocal(1)} />

      {/* Kalender (UI på plads; kan kobles til data i næste step) */}
      <TabPlanning />
    </div>
  );
}
