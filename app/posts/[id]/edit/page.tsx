'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Post = { id: number; title: string | null; body: string | null; image_url: string | null; status: string | null };

type Analysis = { width:number; height:number; aspect_label:string; brightness:number; contrast:number; sharpness:number; verdict:string; suggestions:string[] } | null;

export default function EditPost({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('posts_app')
        .select('id,title,body,image_url,status')
        .eq('id', id)
        .single();
      if (error) setStatusMsg('Kunne ikke hente opslag: ' + error.message);
      else setPost(data as Post);
    }
    load();
  }, [id]);

  async function save() {
    if (!post) return;
    setSaving(true); setStatusMsg('Gemmer...');
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setStatusMsg('Ikke logget ind.'); setSaving(false); return; }
    const resp = await fetch('/api/posts/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id: post.id, title: post.title, body: post.body, image_url: post.image_url, status: post.status })
    });
    if (!resp.ok) setStatusMsg('Fejl: ' + (await resp.text())); else setStatusMsg('Gemt ✔');
    setSaving(false);
  }

  async function duplicate() {
    if (!post) return;
    setStatusMsg('Kopierer...');
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setStatusMsg('Ikke logget ind.'); return; }
    const resp = await fetch('/api/posts/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ source_id: post.id })
    });
    if (!resp.ok) { setStatusMsg('Fejl: ' + (await resp.text())); return; }
    const data = await resp.json();
    setStatusMsg('Kopi oprettet ✔');
    router.push(`/posts/${data.id}/edit`);
  }

  async function analyzePhoto() {
    if (!post?.image_url) { setStatusMsg('Indsæt et billede først.'); return; }
    setStatusMsg(null); setAnalysis(null);
    try {
      const resp = await fetch('/api/media/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: post.image_url, post_id: post.id }) });
      if (!resp.ok) setStatusMsg('Analyse-fejl: ' + (await resp.text()));
      else setAnalysis(await resp.json());
    } catch (e:any) { setStatusMsg('Analyse-fejl: ' + e.message); }
  }

  if (!post) return <main><p>Henter...</p></main>;

  return (
    <main style={{ maxWidth: 640 }}>
      <h2>Redigér opslag #{post.id}</h2>

      <label>Titel</label>
      <input value={post.title ?? ''} onChange={e=>setPost({ ...post, title: e.target.value })} />

      <label>Tekst</label>
      <textarea rows={6} value={post.body ?? ''} onChange={e=>setPost({ ...post, body: e.target.value })} />

      <label>Billede-URL</label>
      <input value={post.image_url ?? ''} onChange={e=>setPost({ ...post, image_url: e.target.value })} />

      <label>Status</label>
      <select value={post.status ?? 'draft'} onChange={e=>setPost({ ...post, status: e.target.value })}>
        <option value="draft">Udkast</option>
        <option value="ready">Klar</option>
        <option value="published">Publiceret (manuelt)</option>
      </select>

      <div style={{ display:'flex', gap:8, marginTop: 12, flexWrap:'wrap' }}>
        <button onClick={save} disabled={saving}>{saving ? 'Gemmer…' : 'Gem ændringer'}</button>
        <button onClick={duplicate}>Gem som kopi</button>
        <button onClick={analyzePhoto} disabled={!post.image_url}>Analyser billede</button>
        <a href="/posts">Tilbage til liste</a>
      </div>

      {analysis && (
        <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <h3>Foto‑feedback</h3>
          <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
          <p><strong>Lys (0‑255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}</p>
          <p><strong>Vurdering:</strong> {analysis.verdict}</p>
          <ul>
            {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      )}

      {statusMsg && <p style={{ marginTop: 8 }}>{statusMsg}</p>}
    </main>
  );
}
