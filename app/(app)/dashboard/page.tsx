'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

type Analysis = {
  width: number;
  height: number;
  aspect_label: string;
  brightness: number;
  contrast: number;
  sharpness: number;
  verdict: string;
  suggestions: string[];
} | null;

type TabKey = 'ai' | 'plan' | 'perf';

export default function DashboardPage() {
  // --------------- HERO-KORT (tællere) ---------------
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [countsErr, setCountsErr] = useState<string | null>(null);

  // --------------- TABS ---------------
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  // --------------- AI-FORSLAG ---------------
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);

  // --------------- HURTIGT OPSLAG ---------------
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<'neutral' | 'tilbud' | 'informativ' | 'hyggelig'>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // --------------- FOTO-HJÆLP ---------------
  const [imageUrl, setImageUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(null);

  // --------------- VIRKSOMHEDSSNAPSHOT ---------------
  const [orgName, setOrgName] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [city, setCity] = useState<string>('');

  // Month start ISO (memo, så den ikke beregnes for hver render)
  const startISO = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // Hent tællere (publicerede)
  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setCountsErr('Ikke logget ind.'); return; }

        // total publicerede
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        // publicerede denne måned
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // AI tekst denne måned
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI foto denne måned
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
  }, [startISO]);

  // Hent virksomheds-snapshot (defensivt: vi forsøger profiler → org)
  useEffect(() => {
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, default_org_id')
          .maybeSingle();

        // forsøg org-navn (hvis vi har lavet en org-tabel – hvis ikke, viser vi bare website senere)
        let org = '';
        if (prof?.default_org_id) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('name, city, website')
            .eq('id', prof.default_org_id)
            .maybeSingle();
          if (orgRow?.name) org = orgRow.name;
          if (orgRow?.website) setWebsite(orgRow.website);
          if (orgRow?.city) setCity(orgRow.city);
        }
        setOrgName(org || 'Din virksomhed');

        // fallback: prøv evt. at finde website i en “brand”-tabel hvis den findes
        if (!website) {
          const { data: brand } = await supabase
            .from('brand_sources')
            .select('origin')
            .eq('kind', 'website')
            .limit(1);
          if (brand && brand[0]?.origin) setWebsite(brand[0].origin);
        }
      } catch {
        // ingen fejlvisning her – kortet har “—” fallback
      }
    })();
  }, []); // kør én gang

  // Første AI-forslag (så der er noget at kigge på)
  useEffect(() => {
    refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSuggestions() {
    setSugErr(null);
    setLoadingSug(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Ikke logget ind');

      // En neutral “idé”-prompt (kan tilpasses pr. branche senere)
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          topic: 'Idéer til opslag for en lokal virksomhed',
          tone: 'neutral'
        })
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || 'AI-fejl');
      }
      const data = await resp.json();
      const arr = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [];
      setSuggestions(arr);
    } catch (e: any) {
      setSugErr(e.message || 'Kunne ikke hente forslag');
      setSuggestions([]);
    } finally {
      setLoadingSug(false);
    }
  }

  function pickSuggestion(s: string) {
    setBody(s);
    // scroll ned til “Hurtigt opslag”
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function improveWithAI() {
    try {
      if (!body.trim()) { setStatusMsg('Skriv eller vælg først noget tekst.'); return; }
      setStatusMsg('Forbedrer tekst…');
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatusMsg('Ikke logget ind.'); return; }

      const toneKey =
        tone === 'tilbud' ? 'tilbud' :
        tone === 'informativ' ? 'informativ' :
        tone === 'hyggelig' ? 'hyggelig' : 'neutral';

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ post_body: body, tone: toneKey })
      });
      if (!r.ok) { setStatusMsg('AI-fejl: ' + (await r.text())); return; }
      const data = await r.json();
      const first = Array.isArray(data.suggestions) && data.suggestions[0] ? String(data.suggestions[0]) : '';
      if (first) {
        setBody(first);
        setStatusMsg('Opdateret med AI ✔');
      } else {
        setStatusMsg('AI gav ikke et brugbart svar. Prøv igen.');
      }
    } catch (e: any) {
      setStatusMsg('Fejl: ' + e.message);
    }
  }

  async function saveDraft() {
    setStatusMsg('Gemmer…'); setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatusMsg('Ikke logget ind.'); return; }
      const r = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title, body, image_url: imageUrl })
      });
      if (!r.ok) { setStatusMsg('Fejl: ' + (await r.text())); return; }
      setStatusMsg('Gemt som udkast ✔');
      // nulstil felter let, men behold titel hvis man vil fortsætte
      setBody('');
      setAnalysis(null);
      // (behold evt. imageUrl – op til dig. Jeg lader den stå.)
    } catch (e: any) {
      setStatusMsg('Fejl: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg('Uploader billede…');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setStatusMsg('Ikke logget ind.'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) { setStatusMsg('Upload-fejl: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      setStatusMsg('Billede uploadet ✔');
    } catch (e: any) {
      setStatusMsg('Fejl: ' + e.message);
    }
  }

  async function analyzePhoto() {
    if (!imageUrl) { setStatusMsg('Tilføj eller upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setStatusMsg(null);
    try {
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (!resp.ok) { setStatusMsg('Analyse-fejl: ' + (await resp.text())); }
      else { setAnalysis(await resp.json()); }
    } catch (e: any) {
      setStatusMsg('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ØVERSTE RÆKKE: 3 kort i én linje */}
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
            I alt: <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
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

        {/* Kort 3: Virksomhedsprofil (snapshot) */}
        <div style={{ ...cardStyle, display: 'grid', gap: 6 }}>
          <div style={cardTitle}>Virksomhedsprofil</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{orgName || 'Din virksomhed'}</div>
          <div style={{ fontSize: 13, color: '#555' }}>
            {city ? `By: ${city}` : 'By: —'}
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Hjemmeside: {website ? <a href={website} target="_blank" rel="noreferrer">{website}</a> : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Kanaler: Facebook <span style={{ opacity: 0.6 }}>(snart)</span> · Instagram <span style={{ opacity: 0.6 }}>(snart)</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <Link href="/brand" style={pillLink}>Se profil →</Link>
          </div>
        </div>
      </section>

      {countsErr && <p style={{ color: '#b00' }}>{countsErr}</p>}

      {/* TABS */}
      <nav style={tabsBar}>
        <button
          onClick={() => setActiveTab('ai')}
          style={activeTab === 'ai' ? tabActive : tabBtn}
        >
          AI Assistent
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          style={activeTab === 'plan' ? tabActive : tabBtn}
        >
          Planlæg & udgiv
        </button>
        <button
          onClick={() => setActiveTab('perf')}
          style={activeTab === 'perf' ? tabActive : tabBtn}
        >
          Performance
        </button>
      </nav>

      {/* INDHOLD UNDER TABS */}
      {activeTab === 'ai' && (
        <section style={{ display: 'grid', gap: 16 }}>
          {/* AI-forslag (3 kort) + “Få 3 nye” */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, flex: '1 1 auto', minWidth: 260 }}>
              { [0,1,2].map((i) => (
                <div key={i} style={{ ...cardStyle, flex: '1 1 0', minWidth: 260, display: 'grid', gridTemplateRows: '1fr auto', gap: 8 }}>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                    {loadingSug ? 'Henter…' : (suggestions[i] || '—')}
                  </div>
                  <div>
                    <button
                      disabled={!suggestions[i]}
                      onClick={() => suggestions[i] && pickSuggestion(suggestions[i])}
                      style={{ width: '100%' }}
                    >
                      Brug dette
                    </button>
                  </div>
                </div>
              )) }
            </div>
            <div>
              <button onClick={refreshSuggestions} disabled={loadingSug}>
                {loadingSug ? 'Henter…' : 'Få 3 nye'}
              </button>
              {sugErr && <div style={{ color: '#b00', marginTop: 6 }}>{sugErr}</div>}
            </div>
          </div>

          {/* Hurtigt opslag + Mini AI-assistent + Foto-hjælp */}
          <div id="quick-post" style={{ display: 'grid', gap: 16 }}>
            {/* Hurtigt opslag */}
            <div style={cardStyle}>
              <div style={cardTitle}>Hurtigt opslag</div>
              <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
                <label style={labelStyle}>Titel (valgfri)</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} />

                <label style={labelStyle}>Tekst</label>
                <textarea rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="Sæt et AI-forslag ind eller skriv selv…" />

                {/* Mini AI-assistent (forbedr tekst) */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Tone:</span>
                  <select value={tone} onChange={e=>setTone(e.target.value as any)}>
                    <option value="neutral">Neutral/Venlig</option>
                    <option value="tilbud">Tilbud</option>
                    <option value="informativ">Informativ</option>
                    <option value="hyggelig">Hyggelig</option>
                  </select>
                  <button type="button" onClick={improveWithAI}>Forbedr med AI</button>
                  <button type="button" onClick={saveDraft} disabled={saving}>{saving ? 'Gemmer…' : 'Gem som udkast'}</button>
                  <Link href="/posts" style={pillLink}>Gå til dine opslag →</Link>
                </div>
              </div>
            </div>

            {/* Foto-hjælp */}
            <div style={cardStyle}>
              <div style={cardTitle}>Foto-hjælp</div>
              <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
                <label style={labelStyle}>Billede-URL (valgfri)</label>
                <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." />
                <label style={labelStyle}>Upload billede (valgfri)</label>
                <input type="file" accept="image/*" onChange={handleFile} />

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={analyzePhoto} disabled={!imageUrl || analyzing}>
                    {analyzing ? 'Analyserer…' : 'Analyser billede'}
                  </button>
                </div>

                {analysis && (
                  <section style={{ marginTop: 6, padding: 10, border: '1px solid #eee', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Foto-feedback</div>
                    <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
                    <p><strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
                    <p><strong>Vurdering:</strong> {analysis.verdict}</p>
                    <ul>
                      {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>

          {statusMsg && <p style={{ color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>{statusMsg}</p>}
        </section>
      )}

      {activeTab === 'plan' && (
        <section style={{ ...cardStyle, minHeight: 180 }}>
          (Planlæg & udgiv) – Kommer snart. Her viser vi kalender/planlægning.
        </section>
      )}

      {activeTab === 'perf' && (
        <section style={{ ...cardStyle, minHeight: 180 }}>
          (Performance) – Kommer snart. Her viser vi topopslag / tider / kanaler.
        </section>
      )}
    </div>
  );
}

/* ---------- STYLES (inline, genbrugelige) ---------- */

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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
};

const pillLink: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  border: '1px solid #ddd',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#fafafa',
  textDecoration: 'none',
  color: 'inherit'
};

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
