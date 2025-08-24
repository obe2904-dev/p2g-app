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

type Tab = 'ai' | 'planning' | 'performance';

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ai'); // standard: AI-assistent

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

        // KUN publicerede i tællingerne
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* HERO-rækken: 1fr 1fr 2fr */}
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
          {/* Tomt for nu – reserveret til mini-indsigt eller hurtig handling */}
        </div>
      </section>

      {/* Faner under hero */}
      <section>
        <div style={tabsBar}>
          <button
            onClick={() => setTab('ai')}
            style={{ ...tabBtn, ...(tab === 'ai' ? tabBtnActive : {}) }}
          >
            AI-assistent
          </button>
          <button
            onClick={() => setTab('planning')}
            style={{ ...tabBtn, ...(tab === 'planning' ? tabBtnActive : {}) }}
          >
            Planlægning & udgivelse
          </button>
          <button
            onClick={() => setTab('performance')}
            style={{ ...tabBtn, ...(tab === 'performance' ? tabBtnActive : {}) }}
          >
            Performance
          </button>
        </div>

        <div style={tabPanel}>
          {tab === 'ai' && (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={cardStyle}>
                <div style={cardTitle}>Hurtigt opslag (tekst)</div>
                <p style={subText}>Skriv et emne. Få 3 forslag. Redigér og gem som opslag.</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input placeholder="Emne (fx 'Dagens kage' eller 'Fredagshygge')" />
                  <textarea rows={4} placeholder="Valgfrit: kladde eller stikord" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href="/posts/new">Åbn AI-tekst</a>
                    <a href="/posts">Gå til Dine opslag</a>
                  </div>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={cardTitle}>Foto-hjælp</div>
                <p style={subText}>Upload eller indsæt billede-URL. Få hurtig billedvurdering.</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input placeholder="Indsæt billede-URL (valgfrit)" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href="/posts/new">Åbn foto-analyse</a>
                    <a href="/media">Gå til Billeder & video</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'planning' && (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={cardStyle}>
                <div style={cardTitle}>Kalender</div>
                <p style={subText}>Se kommende begivenheder og planlæg opslag.</p>
                <a href="/calendar">Åbn kalender</a>
              </div>
              <div style={cardStyle}>
                <div style={cardTitle}>Udgivelse</div>
                <p style={subText}>Manuel publicering i Basic. Autopost i Pro/Premium.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href="/posts">Dine opslag</a>
                  <a href="/posts/new">Nyt opslag</a>
                </div>
              </div>
            </div>
          )}

          {tab === 'performance' && (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={cardStyle}>
                <div style={cardTitle}>Overblik (kommende)</div>
                <p style={subText}>Topopslag, bedste tidspunkt og format (rulles ud med KPI-målinger).</p>
                <a href="/performance">Åbn Performance</a>
              </div>
              <div style={cardStyle}>
                <div style={cardTitle}>Datakilder</div>
                <p style={subText}>Facebook/Instagram i Pro+. Make opdaterer KPI dagligt.</p>
                <a href="/pricing">Se planer</a>
              </div>
            </div>
          )}
        </div>
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
  minWidth: 240, // lidt minimum så de ikke kollapser for meget på smallere skærme
};

const cardTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.2,
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

// Tabs (enkel, uden frameworks)
const tabsBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  borderBottom: '1px solid #eee',
};

const tabBtn: React.CSSProperties = {
  appearance: 'none',
  background: '#fafafa',
  border: '1px solid #e5e5e5',
  borderBottom: 'none',
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 14,
};

const tabBtnActive: React.CSSProperties = {
  background: '#fff',
  borderColor: '#ddd',
  fontWeight: 600,
};

const tabPanel: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  borderTopLeftRadius: 0,
  padding: 12,
  background: '#fff',
  marginTop: -1, // så kanten flugter fint med de aktive faner
};
