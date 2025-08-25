// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
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
  // --- Topkort / tællere ---
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErr('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Kun publicerede i tællerne:
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

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
        setLoadingCounts(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  // --- Tabs ---
  const [tab, setTab] = useState<TabKey>('ai');

  // --- AI-forslag + hurtig opsæt ---
  const [selFacebook, setSelFacebook] = useState(true);
  const [selInstagram, setSelInstagram] = useState(true);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const quickRef = useRef<HTMLDivElement>(null);

  function applySuggestion(text: string) {
    setQuickBody(text);
    // scroll ned til “Hurtigt opslag”
    setTimeout(() => quickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function fetchAISuggestions() {
    try {
      setLoadingAi(true);
      setAiMsg(null);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setAiMsg('Ikke logget ind.'); return; }

      // Brug kanalvalg som “kontekst” i prompt (API’en forstår det som topic)
      const chosen: string[] = [];
      if (selFacebook) chosen.push('Facebook');
      if (selInstagram) chosen.push('Instagram');

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          topic: chosen.length ? `Kanaler: ${chosen.join(', ')}` : undefined,
          tone: undefined,
          post_body: quickBody || ''
        })
      });
      if (!resp.ok) {
        const t = await resp.text();
        setAiMsg('Fejl fra AI: ' + t);
        return;
      }
      const data = await resp.json();
      const arr = Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 3).map((x: any) => String(x)) : [];
      if (!arr.length) {
        setAiMsg('Ingen forslag. Prøv igen.');
      }
      setSuggestions(arr);
    } catch (e: any) {
      setAiMsg(e.message || 'Fejl');
    } finally {
      setLoadingAi(false);
    }
  }

  function copyQuickToClipboard() {
    const text = (quickTitle ? quickTitle + '\n' : '') + (quickBody || '');
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
      setAiMsg('Tekst kopieret ✔ Indsæt i Facebook/Instagram.');
      setTimeout(() => setAiMsg(null), 1500);
    });
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række: 1fr 1fr 2fr */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1 */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loadingCounts ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2 */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loadingCounts ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loadingCounts ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loadingCounts ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3 — dobbelt bredde (pladsholder) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Her kan vi senere vise virksomhedsprofil-overblik (branche, kanaler, adresse, link, “Se profil”) */}
        </div>
      </section>

      {/* Faner */}
      <section style={{ display: 'flex', gap: 8, borderBottom: '1px solid #eee', paddingBottom: 6 }}>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>AI-assistent</TabButton>
        <TabButton active={tab === 'plan'} onClick={() => setTab('plan')}>Planlæg & udgiv</TabButton>
        <TabButton active={tab === 'perf'} onClick={() => setTab('perf')}>Effekt</TabButton>
      </section>

      {/* Indhold pr. fane */}
      {tab === 'ai' && (
        <section style={{ display: 'grid', gap: 16 }}>
          {/* AI-forslag: kanalvalg + knap */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#444' }}>Vælg kanaler (bruges som kontekst):</span>
            <label style={chipLabelStyle}>
              <input type="checkbox" checked={selFacebook} onChange={e => setSelFacebook(e.target.checked)} />
              Facebook
            </label>
            <label style={chipLabelStyle}>
              <input type="checkbox" checked={selInstagram} onChange={e => setSelInstagram(e.target.checked)} />
              Instagram
            </label>
            <button onClick={fetchAISuggestions} disabled={loadingAi} style={btnStyle}>
              {loadingAi ? 'Henter…' : 'Få 3 nye'}
            </button>
            {aiMsg && <span style={{ fontSize: 12, color: '#666' }}>{aiMsg}</span>}
          </div>

          {/* 3 forslag side-om-side */}
          <div style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))'
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={cardStyle}>
                <div style={{ ...cardTitle, marginBottom: 8 }}>Forslag {i + 1}</div>
                <p style={{ whiteSpace: 'pre-wrap', minHeight: 80, marginTop: 0 }}>
                  {suggestions[i] || '—'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => suggestions[i] && applySuggestion(suggestions[i])}
                    disabled={!suggestions[i]}
                    style={btnStyle}
                  >
                    Brug teksten
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Hurtigt opslag */}
          <div ref={quickRef} style={{ ...cardStyle }}>
            <div style={cardTitle}>Hurtigt opslag</div>
            <div style={{ display: 'grid', gap: 8, maxWidth: 680 }}>
              <label style={lblStyle}>Titel (valgfri)</label>
              <input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />

              <label style={lblStyle}>Tekst</label>
              <textarea rows={6} value={quickBody} onChange={e => setQuickBody(e.target.value)} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={copyQuickToClipboard} style={btnStyle}>Kopier tekst</button>
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" style={linkBtnStyle}>Åbn Facebook</a>
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" style={linkBtnStyle}>Åbn Instagram</a>
              </div>
            </div>

            {/* Foto-hjælp lige under “Hurtigt opslag” */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <div style={cardTitle}>Foto-hjælp</div>
              <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
                Upload/indsæt et billede på siden “Nyt opslag” for at få lys/format-feedback – vi flytter analyser herind senere.
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === 'plan' && (
        <section style={placeholderStyle}>
          (Planlæg & udgiv) – kalender og planlægning kommer her.
        </section>
      )}

      {tab === 'perf' && (
        <section style={placeholderStyle}>
          (Effekt) – små KPI-kort og “hvad virker” vises her.
        </section>
      )}

      {err && <p style={{ color: '#b00' }}>{err}</p>}
    </div>
  );
}

/* ---------- styles ---------- */

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: active ? '1px solid #000' : '1px solid #ddd',
        background: active ? '#000' : '#fff',
        color: active ? '#fff' : '#000',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const chipLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #ddd',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 13,
  background: '#fafafa'
};

const btnStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer'
};

const linkBtnStyle: React.CSSProperties = {
  ...btnStyle,
  textDecoration: 'none',
  color: 'inherit'
};

const lblStyle: React.CSSProperties = { fontSize: 12, color: '#555' };

const placeholderStyle: React.CSSProperties = {
  ...cardStyle,
  minHeight: 120,
  color: '#777',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
