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

type UsageState = {
  text: { used: number; limit: number | null };
  photo: { used: number; limit: number | null };
} | null;

export default function EditPost({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [post, setPost] = useState<Post | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const router = useRouter();

  // AI-tekst
  const [tone, setTone] = useState('neutral');
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // AI-tællere
  const [usage, setUsage] = useState<UsageState>(null);

  useEffect(() => {
    load();
    loadUsage();
  }, [id]);

  async function load() {
    const { data, error } = await supabase
      .from('posts_app')
      .select('id,title,body,image_url,status')
      .eq('id', id)
      .single();
    if (error) setStatusMsg('Kunne ikke hente opslag: ' + error.message);
    else setPost(data as Post);
  }

  async function loadUsage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUsage(null); return; }

    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);

    const { count: textCount } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'text')
      .gte('used_at', start.toISOString());

    const { count: photoCount } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'photo')
      .gte('used_at', start.toISOString());

    const { data: prof } = await supabase
      .from('profiles')
      .select('plan_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const plan = prof?.plan_id || 'basic';

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
      else {
        setAnalysis(await resp.json());
        await addUsage('photo', post.id);
        await loadUsage();
      }
    } catch (e:any) {
      setStatusMsg('Analyse-fejl: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function getAiSuggestions() {
    if (!post || (!post.body && !post.title)) { setStatusMsg('Skriv lidt tekst eller et emne i Titel/Brødtekst først.'); return; }
    setAiTextLoading(true); setStatusMsg(null);
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
          topic: post.title || undefined,
          tone,
          post_body: post.body || undefined
        })
      });

      if (resp.status === 402) { setStatusMsg(await resp.text()); return; }
      if (!resp.ok) { setStatusMsg('AI-fejl: ' + (await resp.text())); return; }

      const data = await resp.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      await loadUsage();
    } catch (e:any) {
      setStatusMsg('AI-fejl: ' + e.message);
    } finally {
      setAiTextLoading(false);
    }
  }

  if (!post) return <main><p>Henter...</p></main>;

  return (
    <RequireAuth>
      <main style={{ maxWidth: 640 }}>
        <h2>Redigér opslag #{post.id}</h2>

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

        <label>Titel</label>
        <input value={post.title ?? ''} onChange={e=>setPost({ ...post, title: e.target.value })} />

        <label>Tekst</label>
        <textarea rows={6} value={post.body ?? ''} onChange={e=>setPost({ ...post, body: e.target.value })} />

        {/* AI-tekst — tone + knap */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', margin:'6px 0 10px' }}>
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
                    <button type="button" onClick={() => setPost({ ...post, body: s })}>Brug i tekstfelt</button>
                    <button type="button" onClick={() => navigator.clipboard.writeText(s)}>Kopier</button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <label style={{ marginTop: 10 }}>Billede-URL</label>
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
