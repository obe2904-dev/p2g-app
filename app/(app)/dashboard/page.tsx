// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function DashboardPage() {
  // ── Top-kort data ─────────────────────────────────────────────────────────────
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [errCounts, setErrCounts] = useState<string | null>(null);

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

        // Opslag i alt (kun publicerede)
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        // Opslag denne måned (kun publicerede)
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // AI tekst
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI foto
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

  // ── AI-forslag (3 kort) ───────────────────────────────────────────────────────
  const [tone, setTone] = useState<'neutral'|'hyggelig'|'informativ'|'tilbud'>('neutral');
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [msgSug, setMsgSug] = useState<string | null>(null);

  async function fetchSuggestions() {
    setMsgSug(null);
    setLoadingSug(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setMsgSug('Ikke logget ind.'); return; }

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ topic: topic || undefined, tone })
      });
      if (!resp.ok) {
        setMsgSug('Fejl: ' + (await resp.text()));
        return;
      }
      const data = await resp.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0,3) : []);
      if (!Array.isArray(data.suggestions)) setMsgSug('Kunne ikke hente forslag.');
    } catch (e: any) {
      setMsgSug(e.message || 'Uventet fejl');
    } finally {
      setLoadingSug(false);
    }
  }

  // ── Hurtigt opslag + mini-AI ────────────────────────────────────────────────
  const quickRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function useSuggestion(text: string) {
    setBody(text);
    // scroll til Hurtigt opslag
    setTimeout(() => {
      quickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);
  }

  async function improveText() {
    if (!body.trim()) { setStatus('Skriv eller vælg en tekst først.'); return; }
    setStatus('Forbedrer tekst …');
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatus('Ikke logget ind.'); return; }

      // Genbrug /api/ai/suggest ved at sende body som base
      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ post_body: body, tone })
      });
      if (!resp.ok) { setStatus('Fejl: ' + (await resp.text())); return; }
      const data = await resp.json();
      const first = Array.isArray(data.suggestions) ? String(data.suggestions[0] || '') : '';
      if (first) { setBody(first); setStatus('Teksten er forbedret ✔'); }
      else { setStatus('Kunne ikke forbedre teksten.'); }
    } catch (e:any) {
      setStatus('Fejl: ' + e.message);
    }
  }

  // Meget simpel hashtag-foreslår: finder “nøgleord” og laver 2-4 hashtags
  const stop = useMemo(()=>new Set(['og','i','på','for','med','til','der','det','en','et','de','at','vi','du','jeg','er','som','af','om']),[]);
  function suggestHashtags() {
    if (!body.trim()) { setStatus('Skriv eller vælg en tekst først.'); return; }
    const words = body
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w && !stop.has(w) && w.length > 2);
    const uniq = Array.from(new Set(words));
    const picks = uniq
      .sort((a,b)=>b.length - a.length) // “vigtigere” ord først (meget groft)
      .slice(0,4)
      .map(w => '#' + w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    if (!picks.length) { setStatus('Fandt ingen oplagte hashtags.'); return; }
    const sep = body.endsWith('.') ? ' ' : (body.endsWith(' ') ? '' : ' ');
    setBody(body + sep + picks.join(' '));
    setStatus('Hashtags tilføjet ✔');
  }

  async function saveDraft(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!body.trim()) { setStatus('Skriv noget tekst først.'); return; }
    setSaving(true); setStatus('Gemmer …');
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatus('Ikke logget ind.'); setSaving(false); return; }
      const resp = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: title || null, body, image_url: null })
      });
      if (!resp.ok) { setStatus('Fejl: ' + (await resp.text())); }
      else { setStatus('Udkast gemt ✔'); setTitle(''); setBody(''); }
    } catch (e:any) {
      setStatus('Fejl: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Foto-hjælp (under Hurtigt opslag) ───────────────────────────────────────
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function analyzePhoto() {
    if (!imageUrl.trim()) { setStatus('Indsæt en billede-URL først.'); return; }
    setAnalyzing(true); setAnalysis(null); setStatus(null);
    try {
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ image_url: imageUrl })
      });
      if (!resp.ok) setStatus('Analyse-fejl: ' + (await resp.text()));
      else setAnalysis(await resp.json());
    } catch (e:any) {
      setStatus('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række: to små + én dobbelt */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1: Opslag denne måned (publicerede) */}
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

        {/* Kort 3: Dobbelt bredde (pladsholder – fx Virksomhedsprofil-overblik senere) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Tomt for nu – vi bruger det til overblik/diagram senere */}
        </div>
      </section>

      {/* AI-forslag (3 kort i én række) */}
      <section style={{ ...cardStyle }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
          <strong>AI-forslag</strong>
          <select
            value={tone}
            onChange={e => setTone(e.target.value as any)}
            style={{ border:'1px solid #ddd', borderRadius:8, padding:'6px 8px' }}
            title="Tone"
          >
            <option value="neutral">Neutral/Venlig</option>
            <option value="hyggelig">Hyggelig</option>
            <option value="informativ">Informativ</option>
            <option value="tilbud">Tilbud</option>
          </select>
          <input
            value={topic}
            onChange={e=>setTopic(e.target.value)}
            placeholder="Emne (valgfrit) – fx 'Dagens kage' eller 'Live musik fredag'"
            style={{ flex:1, minWidth:200, border:'1px solid #ddd', borderRadius:8, padding:'6px 8px' }}
          />
          <button onClick={fetchSuggestions} disabled={loadingSug} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>
            {loadingSug ? 'Henter…' : (suggestions.length ? 'Få 3 nye' : 'Hent forslag')}
          </button>
        </div>

        {msgSug && <p style={{ color:'#b00', marginTop:4 }}>{msgSug}</p>}

        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(3, minmax(0,1fr))' }}>
          {[0,1,2].map(i => (
            <div
              key={i}
              style={{
                border:'1px solid #eee',
                borderRadius:10,
                padding:12,
                minHeight:120,
                display:'flex',
                flexDirection:'column',
                justifyContent:'space-between',
                background:'#fafafa'
              }}
            >
              <div style={{ whiteSpace:'pre-wrap' }}>
                {suggestions[i] ? suggestions[i] : <span style={{ color:'#999' }}>— Tomt —</span>}
              </div>
              <div style={{ marginTop:8 }}>
                <button
                  disabled={!suggestions[i]}
                  onClick={() => suggestions[i] && useSuggestion(suggestions[i])}
                  style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}
                >
                  Brug dette
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hurtigt opslag */}
      <section ref={quickRef} style={{ ...cardStyle }}>
        <h3 style={{ marginTop:0, marginBottom:8 }}>Hurtigt opslag</h3>
        <form onSubmit={saveDraft} style={{ display:'grid', gap:8, maxWidth:720 }}>
          <label style={{ fontSize:13 }}>Titel (valgfri)</label>
          <input value={title} onChange={e=>setTitle(e.target.value)}
                 style={{ border:'1px solid #ddd', borderRadius:8, padding:'8px 10px' }} />

          <label style={{ fontSize:13 }}>Tekst</label>
          <textarea
            required
            rows={6}
            value={body}
            onChange={e=>setBody(e.target.value)}
            placeholder="Skriv selv – eller klik på et AI-forslag ovenfor."
            style={{ border:'1px solid #ddd', borderRadius:8, padding:'10px' }}
          />

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button type="button" onClick={improveText}
                    style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>
              Forbedr teksten
            </button>
            <button type="button" onClick={suggestHashtags}
                    style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}>
              Foreslå hashtags
            </button>
            <button type="submit" disabled={saving}
                    style={{ padding:'8px 12px', border:'1px solid #000', borderRadius:8, background:'#fff' }}>
              {saving ? 'Gemmer…' : 'Gem som udkast'}
            </button>
            <a href="/posts" style={{ padding:'8px 10px' }}>Se alle opslag</a>
          </div>
        </form>

        {/* Foto-hjælp under Hurtigt opslag */}
        <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid #eee' }}>
          <h4 style={{ marginTop:0 }}>Foto-hjælp</h4>
          <div style={{ display:'grid', gap:8, maxWidth:720 }}>
            <label style={{ fontSize:13 }}>Billede-URL (valgfri)</label>
            <input
              value={imageUrl}
              onChange={e=>setImageUrl(e.target.value)}
              placeholder="https://…"
              style={{ border:'1px solid #ddd', borderRadius:8, padding:'8px 10px' }}
            />
            <div>
              <button
                type="button"
                onClick={analyzePhoto}
                disabled={!imageUrl || analyzing}
                style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}
              >
                {analyzing ? 'Analyserer…' : 'Analyser billede'}
              </button>
            </div>
          </div>

          {analysis && (
            <section style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
              <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
              <p><strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
              <p><strong>Vurdering:</strong> {analysis.verdict}</p>
              <ul>
                {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}
        </div>

        {status && <p style={{ marginTop:8 }}>{status}</p>}
      </section>

      {errCounts && <p style={{ color: '#b00' }}>{errCounts}</p>}
    </div>
  );
}
