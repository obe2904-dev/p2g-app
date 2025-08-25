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

type PhotoAnalysis = {
  width: number;
  height: number;
  aspect_label: string;
  brightness: number;
  contrast: number;
  sharpness: number;
  verdict: string;
  suggestions: string[];
} | null;

export default function DashboardPage() {
  /*** HERO-KORT (opsummeringer) ***/
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [countsErr, setCountsErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setCountsErr('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Kun publicerede i tællingerne:
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
        setCountsErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoadingCounts(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  /*** FANER (AI Assistent / Planlæg / Performance) ***/
  const [tab, setTab] = useState<'ai' | 'planning' | 'performance'>('ai');

  /*** AI-FORSLAG (3 kort på række) ***/
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  async function fetchSuggestions() {
    setAiErr(null);
    setAiLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setAiErr('Du er ikke logget ind.'); return; }

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({}) // simple: ingen topic/baseBody -> generiske forslag
      });
      if (!r.ok) {
        setAiErr('AI-fejl: ' + (await r.text()));
        return;
      }
      const j = await r.json();
      if (Array.isArray(j.suggestions)) setSuggestions(j.suggestions.slice(0, 3));
      else setSuggestions([]);
    } catch (e: any) {
      setAiErr(e.message || 'AI-fejl');
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    // hent første sæt, når man lander på fanen
    if (tab === 'ai' && suggestions.length === 0 && !aiLoading) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /*** HURTIGT OPSLAG (formular) ***/
  const quickRef = useRef<HTMLDivElement | null>(null);
  const [qpTitle, setQpTitle] = useState('');
  const [qpBody, setQpBody] = useState('');
  const [qpImageUrl, setQpImageUrl] = useState('');
  const [qpStatus, setQpStatus] = useState<string | null>(null);

  function useThisSuggestion(text: string) {
    setQpBody(text);
    // scroll ned til formularen
    setTimeout(() => quickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function copyText() {
    const text = (qpTitle ? qpTitle + '\n' : '') + (qpBody || '');
    if (!text.trim()) return;
    navigator.clipboard.writeText(text);
    setQpStatus('Tekst kopieret ✔ Indsæt i Facebook/Instagram.');
    setTimeout(() => setQpStatus(null), 2000);
  }

  async function saveDraft(e?: React.FormEvent) {
    e?.preventDefault();
    setQpStatus('Gemmer …');
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setQpStatus('Ikke logget ind.'); return; }

      const r = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: qpTitle, body: qpBody, image_url: qpImageUrl })
      });
      if (!r.ok) {
        setQpStatus('Fejl: ' + (await r.text()));
      } else {
        setQpStatus('Gemt som udkast ✔');
        setQpTitle(''); setQpBody(''); setQpImageUrl('');
        setTimeout(() => setQpStatus(null), 2500);
      }
    } catch (e:any) {
      setQpStatus('Fejl: ' + e.message);
    }
  }

  /*** FOTO-HJÆLP (under hurtigt opslag) ***/
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMsg('Uploader billede …');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setPhotoMsg('Du er ikke logget ind.'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) { setPhotoMsg('Upload-fejl: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
      setQpImageUrl(pub.publicUrl);
      setPhotoMsg('Billede uploadet ✔');
    } catch (e:any) {
      setPhotoMsg('Fejl: ' + e.message);
    }
  }

  async function analyzePhoto() {
    if (!qpImageUrl) { setPhotoMsg('Indsæt eller upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setPhotoMsg(null);
    try {
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: qpImageUrl })
      });
      if (!resp.ok) {
        setPhotoMsg('Analyse-fejl: ' + (await resp.text()));
      } else {
        setAnalysis(await resp.json());
      }
    } catch (e:any) {
      setPhotoMsg('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* HERO-rækken: 2 små + 1 dobbelt (pladsholder) */}
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
            {loadingCounts ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2: AI denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loadingCounts ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loadingCounts ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loadingCounts ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Dobbelt bredde – reserveret (fx “Virksomhedsprofil” senere) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Plads til “Virksomhedsprofil” kortet senere */}
        </div>
      </section>

      {countsErr && <p style={{ color: '#b00' }}>{countsErr}</p>}

      {/* FANER */}
      <section>
        <div style={tabsBar}>
          <button
            onClick={() => setTab('ai')}
            style={{ ...tabBtn, ...(tab === 'ai' ? tabBtnActive : {}) }}
          >
            AI Assistent
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
      </section>

      {/* FANE-INDHOLD */}
      {tab === 'ai' && (
        <section style={{ display: 'grid', gap: 16 }}>
          {/* AI-forslag – 3 kort på række */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>AI forslag</h3>
              <button onClick={fetchSuggestions} disabled={aiLoading}>
                {aiLoading ? 'Henter…' : 'Få 3 nye'}
              </button>
            </div>

            {aiErr && <p style={{ color: '#b00' }}>{aiErr}</p>}

            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                alignItems: 'stretch'
              }}
            >
              {(suggestions.length ? suggestions : ['—', '—', '—']).slice(0, 3).map((s, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{s}</div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => useThisSuggestion(s)} disabled={!s || s === '—'}>
                      Brug dette
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hurtigt opslag */}
          <div ref={quickRef} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Hurtigt opslag</h3>
            <form onSubmit={saveDraft} style={{ display: 'grid', gap: 8, maxWidth: 680 }}>
              <label>Titel (valgfri)</label>
              <input value={qpTitle} onChange={e=>setQpTitle(e.target.value)} />

              <label>Tekst (påkrævet)</label>
              <textarea required rows={6} value={qpBody} onChange={e=>setQpBody(e.target.value)} />

              <label>Billede-URL (valgfri)</label>
              <input value={qpImageUrl} onChange={e=>setQpImageUrl(e.target.value)} placeholder="https://..." />

              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop: 6 }}>
                <button type="submit">Gem som udkast</button>
                <button type="button" onClick={copyText}>Kopier tekst</button>
              </div>
            </form>
            {qpStatus && <p style={{ marginTop: 8 }}>{qpStatus}</p>}
          </div>

          {/* Foto-hjælp (under hurtigt opslag) */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Foto-hjælp</h3>
            <div style={{ display:'grid', gap:8, maxWidth: 680 }}>
              <label>Upload billede (valgfri)</label>
              <input type="file" accept="image/*" onChange={handleFile} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button type="button" onClick={analyzePhoto} disabled={!qpImageUrl || analyzing}>
                  {analyzing ? 'Analyserer…' : 'Analyser billede'}
                </button>
                {qpImageUrl && (
                  <a href={qpImageUrl} target="_blank" rel="noreferrer">
                    Åbn billede
                  </a>
                )}
              </div>
              {photoMsg && <p>{photoMsg}</p>}

              {analysis && (
                <section style={{ marginTop: 8, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
                  <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
                  <p><strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
                  <p><strong>Vurdering:</strong> {analysis.verdict}</p>
                  <ul>
                    {analysis.suggestions.map((s, idx) => <li key={idx}>{s}</li>)}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'planning' && (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Planlægning & udgivelse</h3>
          <p>Kommer snart – kalender, planlæg og (senere) autopublicering.</p>
        </section>
      )}

      {tab === 'performance' && (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Performance</h3>
          <p>Kommer snart – topopslag, bedste tidspunkter, reach/likes m.m.</p>
        </section>
      )}
    </div>
  );
}

/*** STYLES ***/
const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  minWidth: 220,
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

const tabsBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  borderBottom: '1px solid #eee',
  paddingBottom: 8,
};

const tabBtn: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
};

const tabBtnActive: React.CSSProperties = {
  borderColor: '#000',
  fontWeight: 600,
};
