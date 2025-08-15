// app/posts/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type Row = { id: number; title: string | null; created_at: string; status: string | null };

const statusLabel = (s?: string | null) =>
  s === 'ready' ? 'Klar'
  : s === 'published' ? 'Udgivet'
  : 'Udkast';

const planLabel = (p?: string | null) =>
  p === 'premium' ? 'Premium'
  : p === 'pro' ? 'Pro'
  : p === 'free' ? 'Gratis'
  : 'Basic';

type UsageState = {
  text: { used: number; limit: number | null };
  photo: { used: number; limit: number | null };
} | null;

type PostDetails = {
  id: number;
  title: string | null;
  body: string | null;
  image_url: string | null;
  status: string | null;
};

export default function PostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageState>(null);

  // AI-hjælp (liste): valgt opslag + UI state
  const [selected, setSelected] = useState<PostDetails | null>(null);
  const [tone, setTone] = useState('neutral');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from('posts_app')
      .select('id, title, created_at, status')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows((data || []) as Row[]);
  }

  async function loadPlan() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPlan(null); return; }
    const { data } = await supabase
      .from('profiles')
      .select('plan_id')
      .eq('user_id', user.id)
      .maybeSingle();
    setPlan(data?.plan_id ?? 'basic');
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

  useEffect(() => { load(); loadPlan(); loadUsage(); }, []);

  async function remove(id: number) {
    const sure = window.confirm('Dette vil slette opslag permanent. Er du sikker?');
    if (!sure) return;
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setInfo('Ikke logget ind.'); return; }
    const resp = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id })
    });
    if (!resp.ok) { setInfo('Fejl: ' + (await resp.text())); return; }
    setInfo('Slettet ✔');
    load();
  }

  // Åbn AI-panel for en række: hent fuldt opslag
  async function openAi(postId: number) {
    setAiMsg(null);
    setSuggestions([]);
    setTone('neutral');

    const { data, error } = await supabase
      .from('posts_app')
      .select('id,title,body,image_url,status')
      .eq('id', postId)
      .single();

    if (error || !data) { setAiMsg('Kunne ikke hente opslag.'); return; }
    setSelected(data as PostDetails);
  }

  function closeAi() {
    setSelected(null);
    setSuggestions([]);
    setAiMsg(null);
  }

  // Hent forslag via eksisterende /api/ai/suggest (samme som på "Nyt/Redigér")
  async function getAiSuggestions() {
    if (!selected || (!selected.title && !selected.body)) {
      setAiMsg('Skriv en titel eller noget tekst først.');
      return;
    }
    setAiLoading(true); setAiMsg(null);
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
          topic: selected.title || undefined,
          tone,
          post_body: selected.body || undefined
        })
      });

      if (resp.status === 402) { setAiMsg(await resp.text()); return; }
      if (!resp.ok) { setAiMsg('AI-fejl: ' + (await resp.text())); return; }

      const data = await resp.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      await loadUsage(); // opdater tæller efter brug (server logger 'text')
    } catch (e: any) {
      setAiMsg('AI-fejl: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  }

  // Opdater body på det valgte opslag med et forslag
  async function applySuggestion(text: string) {
    if (!selected) return;
    setAiMsg('Indsætter forslag i opslag…');
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setAiMsg('Ikke logget ind.'); return; }

      const resp = await fetch('/api/posts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          id: selected.id,
          title: selected.title,
          body: text,
          image_url: selected.image_url,
          status: selected.status
        })
      });

      if (!resp.ok) { setAiMsg('Fejl: ' + (await resp.text())); return; }
      setSelected({ ...selected, body: text });
      setAiMsg('Forslag indsat ✔ (gemt). Du kan finpudse i Redigér.');
    } catch (e: any) {
      setAiMsg('Fejl: ' + e.message);
    }
  }

  const canUseText = usage ? (usage.text.limit === null || usage.text.used < usage.text.limit) : true;

  return (
    <RequireAuth>
      <main>
        <h2>Dine opslag</h2>

        {plan && (
          <p style={{ marginTop: 4 }}>
            Din pakke: <strong>{planLabel(plan)}</strong> · <a href="/pricing">Opgradér</a>
          </p>
        )}

        {/* AI-tællere — lille statuslinje */}
        {usage && (
          <p style={{ margin: '4px 0 12px', color:'#444' }}>
            AI tekst: <strong>{usage.text.used}</strong>/<strong>{usage.text.limit === null ? '∞' : usage.text.limit}</strong> ·{' '}
            AI foto: <strong>{usage.photo.used}</strong>/<strong>{usage.photo.limit === null ? '∞' : usage.photo.limit}</strong>
          </p>
        )}

        {error && <p>Fejl: {error}</p>}
        {info && <p>{info}</p>}

        {rows.length === 0 ? (
          <p>Ingen opslag endnu. <a href="/posts/new">Opret et nyt</a>.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Titel</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Oprettet</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Handling</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: 6 }}>{r.title || '(uden titel)'}</td>
                  <td style={{ padding: 6 }}>{statusLabel(r.status)}</td>
                  <td style={{ padding: 6 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ padding: 6, display: 'flex', gap: 8, flexWrap:'wrap' }}>
                    <Link href={`/posts/${r.id}/edit`}>Redigér</Link>
                    <button onClick={() => remove(r.id)} style={{ color: '#b00' }}>Slet</button>
                    <button
                      onClick={() => openAi(r.id)}
                      disabled={!canUseText}
                      title={canUseText ? 'Få AI-tekstforslag' : 'Din AI-tekst-kvote er opbrugt i denne måned'}
                    >
                      Få AI-tekst
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* AI-panel under tabellen */}
        {selected && (
          <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <h3 style={{ margin: 0 }}>AI-tekst til: “{selected.title || `(opslag #${selected.id})`}”</h3>
              <button onClick={closeAi}>Luk</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ marginRight: 6 }}>Tone:</label>
              <select value={tone} onChange={e=>setTone(e.target.value)}>
                <option value="neutral">Neutral/venlig</option>
                <option value="salg">Mere salg</option>
                <option value="informativ">Informativ</option>
                <option value="hyggelig">Hyggelig</option>
              </select>
              <button onClick={getAiSuggestions} disabled={aiLoading} style={{ marginLeft: 8 }}>
                {aiLoading ? 'Foreslår…' : 'Hent forslag (AI)'}
              </button>
            </div>

            {aiMsg && <p style={{ marginTop: 8 }}>{aiMsg}</p>}

            {suggestions.length > 0 && (
              <ol style={{ marginTop: 12 }}>
                {suggestions.map((s, i) => (
                  <li key={i} style={{ marginTop: 10 }}>
                    <div style={{ whiteSpace:'pre-wrap' }}>{s}</div>
                    <div style={{ display:'flex', gap:8, marginTop: 6, flexWrap:'wrap' }}>
                      <button onClick={() => applySuggestion(s)}>Indsæt i opslag (gem)</button>
                      <button onClick={() => navigator.clipboard.writeText(s)}>Kopier</button>
                      <Link href={`/posts/${selected.id}/edit`}>Åbn i Redigér</Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
