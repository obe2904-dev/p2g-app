// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

type TabKey = 'ai' | 'plan' | 'perf';

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // NYT: aktiv fane (default: AI-assistent)
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErr('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Opslag i alt (KUN publicerede)
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        // Opslag denne måned (KUN publicerede)
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // AI-forbrug – tekst
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI-forbrug – foto
        const { count: aiPhotoThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'photo')
          .gte('used_at', startISO);

        setCounts({
          totalPosts: totalPosts ?? 0,
          postsThisMonth: postsThisMonth ?? 0,
          aiTextThisMonth: aiTextThisMonth ?? 0,
          aiPhotoThisMonth: aiPhotoThisMonth ?? 0,
        });
      } catch (e: any) {
        setErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  // Små helpers til fane-styles
  function tabBtnStyle(active: boolean): React.CSSProperties {
    return {
      padding: '8px 12px',
      border: '1px solid #ddd',
      borderRadius: 8,
      background: active ? '#111' : '#fff',
      color: active ? '#fff' : '#111',
      cursor: 'pointer',
      fontSize: 14,
    };
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række med tre kolonner: 1fr, 1fr, 2fr */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1: Opslag denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2: AI denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loading ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Dobbelt bredde (pladsholder) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Tomt for nu – klar til diagram/indsigt senere */}
        </div>
      </section>

      {/* Faner (dansk) */}
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          style={tabBtnStyle(activeTab === 'ai')}
          aria-pressed={activeTab === 'ai'}
        >
          AI-assistent
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          style={tabBtnStyle(activeTab === 'plan')}
          aria-pressed={activeTab === 'plan'}
        >
          Plan & publicering
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('perf')}
          style={tabBtnStyle(activeTab === 'perf')}
          aria-pressed={activeTab === 'perf'}
        >
          Performance
        </button>
      </nav>

      {/* Tab-indhold (placeholder for nu) */}
      <section style={{ ...cardStyle, minHeight: 220 }}>
        {activeTab === 'ai' && (
          <div>
            <h3 style={{ marginTop: 0 }}>AI-assistent</h3>
            <p style={{ color: '#555' }}>
              Her kommer idébank, tekstforslag og billed-hjælp (branchetilpasset). Vi fylder det ud i næste step.
            </p>
          </div>
        )}
        {activeTab === 'plan' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Plan & publicering</h3>
            <p style={{ color: '#555' }}>
              Her kommer kalenderen, planlagte opslag og (senere) autoposting. Placeholder for nu.
            </p>
          </div>
        )}
        {activeTab === 'perf' && (
          <div>
            <h3 style={{ marginTop: 0 }}>Performance</h3>
            <p style={{ color: '#555' }}>
              Her viser vi KPI-overblik (reach, likes, bedste tidspunkter). Placeholder for nu.
            </p>
          </div>
        )}
      </section>

      {err && <p style={{ color: '#b00' }}>{err}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  minWidth: 240, // lille “værn” mod for smalle kort
};

const cardTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
};

const bigNumber: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.1,
  marginBottom: 6,
};

const subText: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
};
