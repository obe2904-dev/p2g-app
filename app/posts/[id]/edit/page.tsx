// app/posts/[id]/edit/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type Post = {
  id: number;
  title: string | null;
  body: string | null;
  image_url: string | null;
  status: string | null;
};

type Analysis = {
  width:number; height:number; aspect_label:string;
  brightness:number; contrast:number; sharpness:number;
  verdict:string; suggestions:string[];
} | null;

export default function EditPost({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
      body: JSON.stringify({
        id: post.id,
        title: post.title,
        body: post.body,
        image_url: post.image_url,
        status: post.status
      })
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

  async function doDelete() {
    if (!post) return;
    const sure = window.confirm('Dette vil slette opslag permanent. Er du sikker?');
    if (!sure) return;

    setStatusMsg('Sletter...');
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setStatusMsg('Ikke logget ind.'); return; }
    const resp = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id: post.id })
    });
    if (!resp.ok) { setStatusMsg('Fejl: ' + (await resp.text())); return; }
    setStatusMsg('Slettet ✔');
    router.push('/posts');
  }

  // Upload billede direkte på redigér-siden
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !post) return;
    setStatusMsg('Uploader billede...');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setStatusMsg('Du er ikke logget ind. Gå til /login'); return; }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { setStatusMsg('Upload-fejl: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    const url = pub.publicUrl;
    setPost({ ...post, image_url: url });
    setStatusMsg('Billede uploadet ✔ (Husk at gemme ændringer).');
  }

  async function analyzePhoto() {
    if (!post || !post.image_url) { setStatusMsg('Indsæt eller upload et billede først.'); return; }
    setAnalyzing(true); setStatusMsg(null); setAnalysis(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ image_url: post.image_url })
      });
      if (!resp.ok) { setStatusMsg('Analyse-fejl: ' + (await resp.text())); }
      else { setAnalysis(await resp.json()); }
    } catch (e:any) {
      setStatusMsg('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (!post) return <main><p>Henter...</p></main>;

  return (
    <RequireAuth>
      <main style={{ maxWidth: 640 }}>
        <h2>Redigér opslag #{post.id}</h2>

        <label>Titel</label>
        <input value={post.title ?? ''} onChange={e=>setPost({ ...post, title: e.target.value })} />

        <label>Tekst</label>
        <textarea rows={6} value={post.body ?? ''} onChange={e=>setPost({ ...post, body: e.target.value })} />

        <label>Billede-URL</label>
        <input value={post.image_url ?? ''} onChange={e=>setPost({ ...post, image_url: e.target.value })} />

        <label>Upload billede (valgfri)</label>
        <input type="file" accept="image/*" onChange={handleFile} />

        <label>Status</label>
        <select value={post.status ?? 'draft'} onChange={e=>setPost({ ...post, status: e.target.value })}>
          <option value="draft">Udkast</option>
          <option value="ready">Klar</option>
          <option value="published">Udgivet</option>
        </select>

        <div style={{ display:'flex', gap:8, marginTop: 12, flexWrap:'wrap' }}>
          <button onClick={save} disabled={saving}>{saving ? 'Gemmer…' : 'Gem ændringer'}</button>
          <button onClick={duplicate}>Gem som kopi</button>
          <button onClick={analyzePhoto} disabled={!post.image_url || analyzing}>
            {analyzing ? 'Analyserer…' : 'Analyser billede'}
          </button>
          <button onClick={doDelete} style={{ color:'#b00' }}>Slet opslag</button>
          <a href="/posts">Tilbage til liste</a>
        </div>

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

        {statusMsg && <p style={{ marginTop: 8 }}>{statusMsg}</p>}
      </main>
    </RequireAuth>
  );
}
