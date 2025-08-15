// app/posts/new/page.tsx
'use client';
import { useState } from 'react';
import type React from 'react';
import { supabase } from '@/lib/supabaseClient';

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

export default function NewPost() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
      // Send token med for at kunne tælle AI-forbrug pr. bruger/plan
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
        const t = await resp.text();
        setStatus('Analyse-fejl: ' + t);
      } else {
        const data = await resp.json();
        setAnalysis(data);
      }
    } catch (e: any) {
      setStatus('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
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
    }
  }

  function copyToClipboard() {
    const text = (title ? title + '\n' : '') + body;
    navigator.clipboard.writeText(text).then(() => setStatus('Tekst kopieret ✔ Indsæt i Facebook/Instagram.'));
  }

  return (
    <main>
      <h2>Nyt opslag</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>Titel (valgfri)</label>
        <input value={title} onChange={e => setTitle(e.target.value)} />

        <label>Tekst (påkrævet)</label>
        <textarea required rows={5} value={body} onChange={e => setBody(e.target.value)} />

        <label>Billede-URL (valgfri)</label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />

        <label>Upload billede (valgfri)</label>
        <input type="file" accept="image/*" onChange={handleFile} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
