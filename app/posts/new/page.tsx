// app/posts/new/page.tsx
'use client';
import { useState, useEffect } from 'react';
import type React from 'react';
import { supabase } from '@/lib/supabaseClient';

type Analysis = {
  width: number; height: number; aspect_label: string;
  brightness: number; contrast: number; sharpness: number;
  verdict: string; suggestions: string[];
} | null;

export default function NewPost() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // NYT: AI-tekst
  const [tone, setTone] = useState('neutral');
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [textUsage, setTextUsage] = useState<{ used: number; limit: number | null } | null>(null);

  useEffect(() => { loadTextUsage(); }, []);

  async function loadTextUsage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Count denne måneds tekst-forbrug
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const { count } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'text')
      .gte('used_at', start.toISOString());

    // Slå plan + limit op
    const { data: prof } = await supabase.from('profiles').select('plan_id').eq('user_id', user.id).single();
    const plan = prof?.plan_id || 'basic';
    const { data: lim } = await supabase
      .from('plan_features')
      .select('limit_value')
      .eq('plan_id', plan)
      .eq('feature_key', 'ai_text_monthly_limit')
      .maybeSingle();

    setTextUsage({ used: count ?? 0, limit: (lim?.limit_value ?? null) as number | null });
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
    const { error: upErr } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { setStatus('Upload-fejl: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    const url = pub.publicUrl;
    setImageUrl(url);
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
      if (!resp.ok) { const t = await resp.text(); setStatus('Analyse-fejl: ' + t); }
      else { const data = await resp.json(); setAnalysis(data); }
    } catch (e:any) { setStatus('Analyse-fejl: ' + e.message); }
    finally { setAnalyzing(false); }
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
      // Opdater tælleren (vi logger 1 brug pr. kald)
      await loadTextUsage();
    } catch (e:any) {
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
      const text = await resp.text();
      setStatus('Fejl: ' + text);
    } else {
      setStatus('Gemt!');
      setTitle('');
      setBody('');
      setImageUrl('');
      setAnalysis(null);
      setSuggestions([]);
    }
  }

  function copyToClipboard() {
    const text = (title ? title + '\n' : '') + body;
    navigator.clipboard.writeText(text).then(() => setStatus('Tekst kopieret ✔ Indsæt i Facebook/Instagram.'));
  }

  return (
    <main>
      <h2>Nyt opslag</h2>

      {/* Tæller for AI-tekst dette måned */}
      {textUsage && (
        <p style={{ margin: '4px 0 12px' }}>
          AI tekstforslag denne måned: <strong>{textUsage.used}</strong>
          {' '} / {' '}
          <strong>{textUsage.limit === null ? '∞' : textUsage.limit}</strong>
        </p>
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
  );
}
