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

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [errCounts, setErrCounts] = useState<string | null>(null);

  // Tabs
  type Tab = 'ai' | 'plan' | 'perf';
  const [tab, setTab] = useState<Tab>('ai');

  // ---- AI-forslag (øverst i AI-fanen) ----
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  async function loadAISuggestions() {
    try {
      setAiLoading(true);
      setAiMsg(null);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setAiMsg('Ikke logget ind.'); return; }
      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic: 'Generér 3 opslag til min virksomhed', tone: 'neutral/venlig' })
      });
      if (!r.ok) { setAiMsg('Fejl: ' + (await r.text())); return; }
      const data = await r.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0,3) : []);
    } catch (e:any) {
      setAiMsg(e.message || 'Uventet fejl');
    } finally {
      setAiLoading(false);
    }
  }

  // ---- Hurtigt opslag (AI-fanen) ----
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [postMsg, setPostMsg] = useState<string | null>(null);
  async function copyText() {
    const text = (title ? title + '\n' : '') + body;
    await navigator.clipboard.writeText(text);
    setPostMsg('Tekst kopieret ✔');
  }
  async function savePost() {
    try {
      setPostMsg('Gemmer...');
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setPostMsg('Ikke logget ind.'); return; }
      const r = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title, body })
      });
      if (!r.ok) { setPostMsg('Fejl: ' + (await r.text())); return; }
      setPostMsg('Gemt ✔');
      setTitle(''); setBody('');
    } catch (e:any) {
      setPostMsg(e.message || 'Fejl');
    }
  }

  // ---- Foto-hjælp (nu placeret UNDER hurtigt opslag) ----
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<null | {
    width:number; height:number; aspect_label:string;
    brightness:number; contrast:number; sharpness:number;
    verdict:string; suggestions:string[];
  }>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMsg('Uploader billede...');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setPhotoMsg('Du er ikke logget ind.'); return; }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { setPhotoMsg('Upload-fejl: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    setImageUrl(pub.publicUrl);
    setPhotoMsg('Billede uploadet ✔ Du kan nu analysere.');
  }

  async function analyzePhoto() {
    if (!imageUrl) { setPhotoMsg('Indsæt eller upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setPhotoMsg(null);
    try {
      const resp = await fetch('/api/media/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (!resp.ok) { const t = await resp.text(); setPhotoMsg('Analyse-fejl: ' + t); }
      else { setAnalysis(await resp.json()); }
    } catch (e:any) { setPhotoMsg('Analyse-fejl: ' + e.message); }
    finally { setAnalyzing(false); }
  }

  // ---- Counts (hero-kort) ----
  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErrCounts('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const startISO = monthStart.toISOString();

        // KUN publicerede
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
      } catch (e:any) {
        setErrCounts(e.message || 'Kunne ikke hente data');
      } finally {
        setLoadingCounts(false);
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
        {/* Kort 1: Opslag denne måned (og total) */}
        <div style={card}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>{loadingCounts ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}</div>
          <div style={subText}>I alt: <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong></div>
        </div>

        {/* Kort 2: AI denne måned */}
        <div style={card}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loadingCounts ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loadingCounts ? '—' : counts.aiTextThisMonth}</strong> · Foto: <strong>{loadingCounts ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Dobbelt bredde – pladsholder (fx Virksomhedsprofil-overblik) */}
        <div style={{ ...card, minHeight: 120 }}>
          {/* TODO: Virksomhedsprofil-overblik (branche, kanaler, adresse, “Se profil”) */}
        </div>
      </section>

      {/* Tabs */}
      <section style={{ display:'flex', gap:8, borderBottom:'1px solid #eee', paddingBottom:8 }}>
        <TabButton label="AI Assistent" active={tab==='ai'} onClick={()=>setTab('ai')} />
        <TabButton label="Planlægning & Udgivelse" active={tab==='plan'} onClick={()=>setTab('plan')} />
        <TabButton label="Performance" active={tab==='perf'} onClick={()=>setTab('perf')} />
      </section>

      {/* TAB INDHOLD */}
      {tab === 'ai' && (
        <section style={{ display:'grid', gap:12 }}>
          {/* AI-forslag */}
          <div style={card}>
            <div style={cardTitle}>AI forslag</div>
            <div style={{ display:'grid', gap:8 }}>
              {suggestions.length === 0 ? (
                <p style={{ color:'#555' }}>Klik “Nye forslag” for at få 3 idéer til opslag.</p>
              ) : (
                <ul style={{ margin:0, paddingLeft:18 }}>
                  {suggestions.map((s,i)=><li key={i}>{s}</li>)}
                </ul>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={loadAISuggestions} disabled={aiLoading}>{aiLoading ? 'Henter…' : 'Nye forslag'}</button>
                {aiMsg && <span style={{ color:'#b00' }}>{aiMsg}</span>}
              </div>
            </div>
          </div>

          {/* Hurtigt opslag */}
          <div style={card}>
            <div style={cardTitle}>Hurtigt opslag</div>
            <div style={{ display:'grid', gap:8, maxWidth: 680 }}>
              <label>Titel (valgfri)</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} />
              <label>Tekst</label>
              <textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={savePost}>Gem som udkast</button>
                <button onClick={copyText}>Kopier tekst</button>
                {postMsg && <span style={{ color:'#555' }}>{postMsg}</span>}
              </div>
            </div>
          </div>

          {/* Foto-hjælp — NU UNDER “Hurtigt opslag” */}
          <div style={card}>
            <div style={cardTitle}>Foto-hjælp</div>
            <div style={{ display:'grid', gap:8, maxWidth: 680 }}>
              <label>Billede-URL (valgfri)</label>
              <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." />
              <label>… eller upload billede</label>
              <input type="file" accept="image/*" onChange={handleFile} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={analyzePhoto} disabled={!imageUrl || analyzing}>{analyzing ? 'Analyserer…' : 'Analyser billede'}</button>
                {photoMsg && <span style={{ color:'#555' }}>{photoMsg}</span>}
              </div>

              {analysis && (
                <section style={{ marginTop: 8, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
                  <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
                  <p><strong>Lys:</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
                  <p><strong>Vurdering:</strong> {analysis.verdict}</p>
                  <ul>{analysis.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul>
                </section>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'plan' && (
        <section style={{ ...card, minHeight: 220 }}>
          {/* Pladsholder: Kalender/planlægning kommer her senere */}
          <p style={{ margin:0, color:'#555' }}>Planlægning & Udgivelse – kommer snart.</p>
        </section>
      )}

      {tab === 'perf' && (
        <section style={{ ...card, minHeight: 220 }}>
          {/* Pladsholder: Performance/KPI kort kommer her senere */}
          <p style={{ margin:0, color:'#555' }}>Performance – kommer snart.</p>
        </section>
      )}

      {errCounts && <p style={{ color:'#b00' }}>{errCounts}</p>}
    </div>
  );
}

function TabButton({ label, active, onClick }:{ label:string; active:boolean; onClick:()=>void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        border: '1px solid ' + (active ? '#000' : '#ddd'),
        borderBottom: active ? '2px solid #000' : '1px solid #ddd',
        borderRadius: 8,
        background: active ? '#f9f9f9' : '#fff',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}

const card: React.CSSProperties = {
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
