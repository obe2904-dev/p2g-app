'use client';

import { useState } from 'react';
import TabAiAssistant from '@/components/dashboard/TabAiAssistant';
import TabPlanning from '@/components/dashboard/TabPlanning';
import TabPerformance from '@/components/dashboard/TabPerformance';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'ai'|'plan'|'perf'>('ai');

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      {/* Tabs header */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('ai')}
          style={tabBtn(activeTab === 'ai')}
        >AI Assistent</button>

        <button
          onClick={() => setActiveTab('plan')}
          style={tabBtn(activeTab === 'plan')}
        >Planlæg & udgiv</button>

        <button
          onClick={() => setActiveTab('perf')}
          style={tabBtn(activeTab === 'perf')}
        >Performance</button>
      </div>

      {/* Indhold */}
      <div style={{ display: 'grid', gap: 16 }}>
        {activeTab === 'ai' && <TabAiAssistant />}
        {activeTab === 'plan' && <TabPlanning />}
        {activeTab === 'perf' && <TabPerformance />}
      </div>
    </main>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    border: '1px solid #eee',
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#111',
    borderRadius: 999,
    cursor: 'pointer'
  };
}
