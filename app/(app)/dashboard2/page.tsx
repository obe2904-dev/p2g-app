// app/(app)/dashboard2/page.tsx
'use client';

export const dynamic = 'force-dynamic'; // undgå SSG/ISR – hold data & kvoter friske i klienten

import HeroRow from '@/components/dashboard/HeroRow';
import TabAiAssistant from '@/components/dashboard/TabAiAssistant';
import TabPlanning from '@/components/dashboard/TabPlanning';
import { useCounts } from '@/components/dashboard/useCounts';
import { useOrgSnapshot } from '@/components/dashboard/useOrgSnapshot';

export default function Dashboard2Page() {
  const { counts, loading, bumpAiTextLocal } = useCounts();
  const org = useOrgSnapshot();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række: KPI/Org snapshot */}
      <HeroRow counts={counts} loading={loading} org={org} />

      {/* Hovedflow: platformvalg → 3 forslag → tekst+foto (to kolonner inde i komponenten) */}
      <TabAiAssistant onAiTextUse={() => bumpAiTextLocal(1)} />

      {/* Kalender (pt. placeholder i repoet, men UI’et er på plads) */}
      <TabPlanning />
    </div>
  );
}
