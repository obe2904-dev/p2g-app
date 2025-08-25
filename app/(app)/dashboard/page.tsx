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

type SuggestionState = {
  items: string[];
  loading: boolean;
  error: string | null;
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

export default function DashboardPage() {
  // Hero-kort tal
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [errCounts, setErrCounts] = useState<string | null>(null);

  // AI-forslag
  const [suggest, setSuggest] = useState<SuggestionState>({
    items: [],
    loading: false,
    error: null,
  });

  // Kanal-valg (gem midlertidigt i localStorage)
  const [useFacebook, setUseFacebook] = useState(true);
  const [useInstagram, setUseInstagram] = useState(true);

  // Hurtigt opslag
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [quickStatusMsg, setQuickStatusMsg] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState('Gør teksten lidt kortere og mere indbydende.');

  // Foto-hjælp
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Load kanal-valg fra localStorage ved mount
  useEffect(() => {
    try {
      const fb = localStorage.getItem('dash_useFacebook');
      const ig = localStorage.getItem('dash_useInstagram');
      if (fb !== null) setUseFacebook(fb === '1');
      if (ig !== null) setUseInstagram(ig === '1');
    } catch {}
  }, []);

  // Gem kanal-valg
  useEffect(() => {
    try { localStorage.setItem('dash_useFacebook', useFacebook ? '1' : '0'); } catch {}
  }, [useFacebook]);
  useEffect(() => {
    try { localStorage.setItem('dash_useInstagram', useInstagram ? '1' : '0'); } catch {}
  }, [useInstagram]);

  // Hent hero-kort tal
  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErrCounts('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Kun publicerede
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
        setErrCounts(e.message || 'Kunne ikke hente data');
      } finally {
        setLoadingCounts(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  async function fetchSuggestions() {
    setSuggest(s => ({ ...s, loading: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setSuggest({ items: [], loading: false, error: 'Ikke logget ind.' }); return; }

      // Brug kanaler som kontekst i emnet (topic), så vi kan specialisere senere
      const channels: string[] = [
        ...(useFacebook ? ['facebook'] : []),
        ...(useInstagram ? ['instagram'] : []),
      ];
      const topic = channels.length ? `Lav forslag egnet til: ${channels.join(' & ')}` : 'Lav forslag';

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic })
      });

      if (resp.status === 402) {
        setSuggest({ items: [], loading: false, error: 'Din AI-tekst-kvote for denne måned er opbrugt.' });
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        setSuggest({ items: [], loading: false, error: 'Fejl: ' + t });
        return;
      }

      const data = await resp.json();
      const items: string[] = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [];
      setSuggest({ items, loading: false, error: null });
    } catch (e: any) {
      setSuggest({ items: [], loading: false, error: e.message || 'Uventet fejl' });
    }
  }

  function pickSuggestion(s: string) {
    // Læg forslaget ned i “Hurtigt opslag”
    if (!quickBody.trim()) {
      setQuickBody(s);
    } else {
      // Hvis der allerede står noget, tilføj en tom linje + forslaget
      setQuickBody(prev => (prev ? prev + '\n\n' + s : s));
    }
    // Scroll blidt til Hurtigt opslag
    try {
      document.getElementById('quick-post')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}
  }

  async function aiRewrite() {
    if (!quickBody.trim()) { setQuickStatusMsg('Skriv eller vælg først en tekst.'); return; }
    setQuickStatusMsg('Foreslår variation…');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setQuickStatusMsg('Ikke logget ind.'); return; }

      // Genbrug /api/ai/suggest til at få 1–3 variationer – vælg #1
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic: aiInstruction, post_body: quickBody })
      });

      if (resp.status === 402) { setQuickStatusMsg('Din AI-tekst-kvote er opbrugt.'); return; }
      if (!resp.ok) { setQuickStatusMsg('Fejl: ' + (await resp.text())); return; }

      const data = await resp.json();
      const items: string[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (!items.length) { setQuickStatusMsg('Ingen variation modtaget.'); return; }

      setQuickBody(items[0]);
      setQuickStatusMsg('Opdateret ✔');
    } catch (e: any) {
      setQuickStatusMsg('Fejl: ' + e.message);
    }
  }

  async function saveDraft() {
    if (!quickBody.trim()) { setQuickStatusMsg('Skriv en tekst først.'); return; }
    setQuickStatusMsg('Gemmer kladde…');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setQuickStatusMsg('Ikke logget ind.'); return; }

      const resp = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          title: quickTitle || null,
          body: quickBody,
          image_url: imageUrl || null,
          // (status sættes til udkast i API'et – hvis ikke, kan vi sende 'draft' her)
        })
      });

      if (!resp.ok) { setQuickStatusMsg('Fejl: ' + (await resp.text())); return; }
      setQuickStatusMsg('Kladde gemt ✔');
      // Nulstil tekstfelter? Vi lader dem stå, så brugeren kan arbejde videre.
    } catch (e: any) {
      setQuickStatusMsg('Fejl: ' + e.message);
    }
  }

  async function analyzePhoto() {
    if (!imageUrl.trim()) { setQuickStatusMsg('Indsæt et billede-link først.'); return; }
    setQuickStatusMsg(null);
    setAnalysis(null);
    setAnalyzing(true);

    try {
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (!resp.ok) { setQuickStatusMsg('Analyse-fejl: ' + (await resp.text())); return; }
      setAnalysis(await resp.json());
    } catch (e: any) {
      setQuickStatusMsg('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række — tre kort på én linje */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1: Opslag denne måned + i alt */}
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

        {/* Kort 3: Dobbelt bredde (pladsholder til senere diagram/indsigt) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Tomt for nu */}
        </div>
      </section>

      {errCounts && <p style={{ color: '#b00' }}>{errCounts}</p>}

      {/* AI Assistent — Forslag (3 kort) */}
      <section style={{ ...cardStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>AI forslag</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={useFacebook}
                onChange={e => setUseFacebook(e.target.checked)}
              />
              Facebook
            </label>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={useInstagram}
                onChange={e => setUseInstagram(e.target.checked)}
              />
              Instagram
            </label>
            <button onClick={fetchSuggestions} disabled={suggest.loading}>
              {suggest.loading ? 'Henter…' : 'Få 3 nye'}
            </button>
          </div>
        </div>

        {suggest.error && <p style={{ color: '#b00', marginTop: 4 }}>{suggest.error}</p>}

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
          }}
        >
          {(suggest.items.length ? suggest.items : [null, null, null]).map((s, i) => (
            <button
              key={i}
              onClick={() => s && pickSuggestion(s)}
              disabled={!s}
              title={s || 'Klik “Få 3 nye” for at hente forslag'}
              style={{
                textAlign: 'left',
                border: '1px solid #eee',
                borderRadius: 12,
                background: s ? '#fff' : '#fafafa',
                padding: 12,
                cursor: s ? 'pointer' : 'default',
                minHeight: 96,
              }}
            >
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                Forslag {i + 1}
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>
                {s || '—'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Hurtigt opslag (+ AI-variation) */}
      <section id="quick-post" style={{ ...cardStyle }}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Hurtigt opslag</h3>

        <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
          <label>Titel (valgfri)</label>
          <input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />

          <label>Tekst</label>
          <textarea
            rows={6}
            value={quickBody}
            onChange={e => setQuickBody(e.target.value)}
            placeholder="Vælg et AI-forslag ovenfor eller skriv selv…"
          />

          {/* Mini AI-assistent */}
          <div
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <input
              value={aiInstruction}
              onChange={e => setAiInstruction(e.target.value)}
              placeholder="Fx: kortere, mere salg, mere hyggelig, tilføj hashtag…"
            />
            <button type="button" onClick={aiRewrite}>Foreslå variation</button>
          </div>

          {/* Foto-hjælp flyttet herunder */}
          <div style={{ marginTop: 8 }}>
            <label>Billede-URL (valgfri)</label>
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={analyzePhoto} disabled={!imageUrl || analyzing}>
                {analyzing ? 'Analyserer…' : 'Analyser billede'}
              </button>
            </div>

            {analysis && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
                <h4 style={{ marginTop: 0 }}>Foto-feedback</h4>
                <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
                <p>
                  <strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}
                </p>
                <p><strong>Vurdering:</strong> {analysis.verdict}</p>
                <ul>
                  {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" onClick={saveDraft}>Gem som kladde</button>
            <a href="/posts">Gå til dine opslag</a>
          </div>

          {quickStatusMsg && <p style={{ marginTop: 6 }}>{quickStatusMsg}</p>}
        </div>
      </section>
    </div>
  );
}

/* ——— Stilarter (samme visuelle sprog som hidtil) ——— */
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

const checkLabel: React.CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  fontSize: 13,
};
