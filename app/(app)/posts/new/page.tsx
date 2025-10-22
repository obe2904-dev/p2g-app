// app/posts/new/page.tsx
'use client';
import { useState, useEffect } from 'react';
import type React from 'react';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type Analysis = {
  width: number; height: number; aspect_label: string;
  brightness: number; contrast: number; sharpness: number;
  verdict: string; suggestions: string[];
} | null;

type UsageState = {
  text: { used: number; limit: number | null };
  photo: { used: number; limit: number | null };
} | null;

const DRAFT_TITLE_KEY = 'p2g_draft_title';
const DRAFT_BODY_KEY = 'p2g_draft_body';
const DRAFT_PHOTO_KEY = 'p2g_photo_idea';

export default function NewPost() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // Foto-analyse
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // AI-tekst
  const [tone, setTone] = useState('neutral');
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // AI-tællere
  const [usage, setUsage] = useState<UsageState>(null);

  // --- Hydration from localStorage on mount ---
  useEffect(() => {
    // Hydrate draft title
    const persistedTitle = typeof window !== "undefined" ? localStorage.getItem(DRAFT_TITLE_KEY) : null;
    if (persistedTitle) setTitle(persistedTitle);

    // Hydrate draft body
    const persistedBody = typeof window !== "undefined" ? localStorage.getItem(DRAFT_BODY_KEY) : null;
    if (persistedBody) setBody(persistedBody);

    // Hydrate draft photo
    const persistedPhoto = typeof window !== "undefined" ? localStorage.getItem(DRAFT_PHOTO_KEY) : null;
    if (persistedPhoto) setImageUrl(persistedPhoto);

    loadUsage();
  }, []);

  useEffect(() => {
    // Persist title
    if (title !== undefined && typeof window !== "undefined") {
      localStorage.setItem(DRAFT_TITLE_KEY, title);
    }
  }, [title]);

  useEffect(() => {
    // Persist body
    if (body !== undefined && typeof window !== "undefined") {
      localStorage.setItem(DRAFT_BODY_KEY, body);
    }
  }, [body]);

  useEffect(() => {
    // Persist photo URL
    if (imageUrl !== undefined && typeof window !== "undefined") {
      localStorage.setItem(DRAFT_PHOTO_KEY, imageUrl);
    }
  }, [imageUrl]);

  async function loadUsage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUsage(null); return; }

    // Denne måneds start
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);

    // Count TEXT
    const { count: textCount } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'text')
      .gte('used_at', start.toISOString());

    // Count PHOTO
    const { count: photoCount } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'photo')
      .gte('used_at', start.toISOString());

    // Find plan
    const { data: prof } = await supabase
      .from('profiles')
      .select('plan_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const plan = prof?.plan_id || 'basic';

    // Limits fra plan_features
    const { data: features } = await supabase
      .from('plan_features')
      .select('feature_key, limit_value')
      .in('feature_key', ['ai_text_monthly_limit', 'ai_photo_monthly_limit'])
      .eq('plan_id', plan);

    const limits = Object.fromEntries((features ?? []).map(f => [f.feature_key, f.limit_value])) as Record<string, number>;

    setUsage({
      text:  { used: textCount ?? 0,  limit: Number.isFinite(limits['ai_text_monthly_limit'])  ? limits['ai_text_monthly_limit']  : null },
      photo: { used: photoCount ?? 0, limit: Number.isFinite(limits['ai_photo_monthly_limit']) ? limits['ai_photo_monthly_limit'] : null },
    });
  }

  async function addUsage(kind: 'text' | 'photo', postId?: number) {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return;
    await fetch('/api/ai/usage/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ kind, post_id: postId })
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Uploader billede...');

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setStatus('Du er ikke logget ind. Gå til /login'); return; }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('images').upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (upErr) { setStatus('Upload-fejl: ' + upErr.message); return; }

    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    setImageUrl(pub.publicUrl);
    setStatus('Billede uploadet ✔ Du kan nu analysere eller gemme.');
  }

  async function analyzePhoto() {
    if (!imageUrl) { setStatus('Indsæt eller upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setStatus(null);

    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;

      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!resp.ok) {
        setStatus('Analyse-fejl: ' + (await resp.text()));
      } else {
        setAnalysis(await resp.json());
        // Log en photo-usage ved succes
        await addUsage('photo');
        await loadUsage();
      }
    } catch (e: any) {
      setStatus('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function getAiSuggestions() {
    if (!body && !title) { setStatus('Skriv lidt tekst eller et emne i Titel/Brødtekst først.'); return; }
    setAiTextLoading(true); setStatus(null);

    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          topic: title || undefined,
          tone,
          post_body: body || undefined
        })
      });

      if (resp.status === 402) {
        setStatus(await resp.text()); // “kvote opbrugt”
        return;
      }
      if (!resp.ok) {
        setStatus('AI-fejl: ' + (await resp.text()));
        return;
      }

      const data = await resp.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      await loadUsage(); // opdater tæller efter brug (suggest API registrerer selv 'text')
    } catch (e: any) {
      setStatus('AI-fejl: ' + e.message);
    } finally {
      setAiTextLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Gemmer...');

    const { data: sessionData } = await supabase.auth.getSession();
    const access_token = sessionData.session?.access_token;
    if (!access_token) { setStatus('Du er ikke logget ind. Gå til /login'); return; }

    const resp = await fetch('/api/posts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + access_token },
      body: JSON.stringify({ title, body, image_url: imageUrl })
    });

    if (!resp.ok) {
      setStatus('Fejl: ' + (await resp.text()));
    } else {
      setStatus('Gemt!');
      setTitle(''); setBody(''); setImageUrl('');
      setAnalysis(null); setSuggestions([]);
      // Clear persisted draft/photo
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_TITLE_KEY);
        localStorage.removeItem(DRAFT_BODY_KEY);
        localStorage.removeItem(DRAFT_PHOTO_KEY);
      }
    }
  }

  function copyToClipboard() {
    const text = (title ? title + '\n' : '') + body;
    navigator.clipboard.writeText(text)
      .then(() => setStatus('Tekst kopieret ✔ Indsæt i Facebook/Instagram.'));
  }

  return (
    <RequireAuth>
      <main>
        <h2>Nyt opslag</h2>

        {/* AI-tællere */}
        {usage && (
          <div style={{ display:'grid', gap:4, margin:'4px 0 12px' }}>
            <p style={{ margin: 0 }}>
              AI tekstforslag denne måned: <strong>{usage.text.used}</strong> / <strong>{usage.text.limit === null ? '∞' : usage.text.limit}</strong>
            </p>
            <p style={{ margin: 0 }}>
              AI billedanalyse denne måned: <strong>{usage.photo.used}</strong> / <strong>{usage.photo.limit === null ? '∞' : usage.photo.limit}</strong>
            </p>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <label>Titel (valgfri)</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} />

          <label>Tekst (påkrævet)</label>
          <textarea required rows={5} value={body} onChange={e=>setBody(e.target.value)} />

          {/* AI-tekst: tone + knap */}
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ marginRight: 4 }}>Tone:</label>
            <select value={tone} onChange={e=>setTone(e.target.value)}>
              <option value="neutral">Neutral/venlig</option>
              <option value="salg">Mere salg</option>
              <option value="informativ">Informativ</option>
              <option value="hyggelig">Hyggelig</option>
            </select>
            <button type="button" onClick={getAiSuggestions} disabled={aiTextLoading}>
              {aiTextLoading ? 'Foreslår…' : 'Få tekstforslag (AI)'}
            </button>
          </div>

          {/* Forslag-liste */}
          {suggestions.length > 0 && (
            <section style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
              <strong>Forslag:</strong>
              <ol>
                {suggestions.map((s, i) => (
                  <li key={i} style={{ marginTop:8 }}>
                    <div style={{ whiteSpace:'pre-wrap' }}>{s}</div>
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <button type="button" onClick={() => setBody(s)}>Brug i tekstfelt</button>
                      <button type="button" onClick={() => navigator.clipboard.writeText(s)}>Kopier</button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <label>Billede-URL (valgfri)</label>
          <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." />

          <label>Upload billede (valgfri)</label>
          <input type="file" accept="image/*" onChange={handleFile} />

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button type="button" onClick={analyzePhoto} disabled={!imageUrl || analyzing}>
              {analyzing ? 'Analyserer…' : 'Analyser billede'}
            </button>
            <button type="submit">Gem opslag</button>
            <button type="button" onClick={copyToClipboard}>Kopier tekst</button>
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Åbn Facebook</a>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Åbn Instagram</a>
          </div>
        </form>

        {analysis && (
          <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <h3>Foto-feedback</h3>
            <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
            <p><strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
            <p><strong>Vurdering:</strong> {analysis.verdict}</p>
            <ul>
              {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>
        )}

        {status && <p style={{ marginTop: 8 }}>{status}</p>}
      </main>
    </RequireAuth>
  );
}