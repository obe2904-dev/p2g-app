'use client';

import { useState } from 'react';
import { useCounts } from '@/components/dashboard/useCounts';
import { useOrgSnapshot } from '@/components/dashboard/useOrgSnapshot';
import HeroRow from '@/components/dashboard/HeroRow';
import TabAiAssistant from '@/components/dashboard/TabAiAssistant';
import TabPlanning from '@/components/dashboard/TabPlanning';
import TabPerformance from '@/components/dashboard/TabPerformance';

export const dynamic = 'force-dynamic';

type TabKey = 'ai' | 'plan' | 'perf';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  // Hent data via hooks (deles mellem HeroRow og faner)
  const { counts, setCounts, loading, err, bumpAiTextLocal } = useCounts();
  const org = useOrgSnapshot();

  // når AI-forslag hentes, bump tæller lokalt
  function handleAiTextBump() {
    bumpAiTextLocal(1);
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række */}
      <HeroRow counts={counts} loading={loading} org={org} />
      {err && <p style={{ color: '#b00' }}>{err}</p>}

      {/* Tabs */}
      <nav style={tabsBar}>
        <button onClick={() => setActiveTab('ai')} style={activeTab === 'ai' ? tabActive : tabBtn}>AI Assistent</button>
        <button onClick={() => setActiveTab('plan')} style={activeTab === 'plan' ? tabActive : tabBtn}>Planlæg & udgiv</button>
        <button onClick={() => setActiveTab('perf')} style={activeTab === 'perf' ? tabActive : tabBtn}>Performance</button>
      </nav>

      {/* Indhold */}
      {activeTab === 'ai' && <TabAiAssistant onAiTextUse={handleAiTextBump} />}
      {activeTab === 'plan' && <TabPlanning />}
      {activeTab === 'perf' && <TabPerformance />}
    </div>
  );
}

const tabsBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  borderBottom: '1px solid #eee',
  paddingBottom: 6,
};

const tabBtn: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #eee',
  background: '#fff',
  borderRadius: 999,
  cursor: 'pointer',
};

const tabActive: React.CSSProperties = {
  ...tabBtn,
  background: '#111',
  color: '#fff',
  borderColor: '#111',
};
