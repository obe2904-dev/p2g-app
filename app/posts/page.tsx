//app/(app)/posts/new/page.tsx
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

export default function PostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageState>(null);

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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RequireAuth>
  );
}
