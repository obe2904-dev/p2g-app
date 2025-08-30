'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Post = { id: number; title: string | null; created_at: string };
type MetricRow = { post_id: number; channel: string; metric: string; value: number; observed_at: string };

type Totals = {
  impressions: number;
  engaged_users: number;
  reactions: number;
  comments: number;
  shares: number;
};

function emptyTotals(): Totals {
  return { impressions: 0, engaged_users: 0, reactions: 0, comments: 0, shares: 0 };
}

export default function PerformancePage() {
  const [sinceDays, setSinceDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);

  // Hent data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setStatus('Henter data…');

      // Tjek login (RLS kræver auth)
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setStatus('Du er ikke logget ind. Gå til /login');
        setLoading(false);
        return;
      }

      const sinceISO = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();

      // 1) Hent dine posts
      const { data: postsData, error: pErr } = await supabase
        .from('posts_app')
        .select('id,title,created_at')
        .order('created_at', { ascending: false });
      if (pErr) {
        setStatus('Kunne ikke hente posts: ' + pErr.message);
        setLoading(false);
        return;
      }

      // 2) Hent KPI’er siden sinceISO
      const { data: metrData, error: mErr } = await supabase
        .from('posts_metrics')
        .select('post_id,channel,metric,value,observed_at')
        .gte('observed_at', sinceISO)
        .order('observed_at', { ascending: false });

      if (mErr) {
        setStatus('Kunne ikke hente metrics: ' + mErr.message);
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setPosts((postsData || []) as Post[]);
        setMetrics((metrData || []) as MetricRow[]);
        setStatus(null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sinceDays]);

  // Aggreger pr. post (sidste X dage)
  const perPost = useMemo(() => {
    const map = new Map<number, Totals>();
    for (const row of metrics) {
      const t = map.get(row.post_id) ?? emptyTotals();
      const v = Number(row.value || 0);
      if (row.metric === 'impressions') t.impressions += v;
      else if (row.metric === 'engaged_users') t.engaged_users += v;
      else if (row.metric === 'reactions') t.reactions += v;
      else if (row.metric === 'comments') t.comments += v;
      else if (row.metric === 'shares') t.shares += v;
      map.set(row.post_id, t);
    }
    return map;
  }, [metrics]);

  // Toplinje (sum af alle posts)
  const topline = useMemo(() => {
    const t = emptyTotals();
    for (const [, vals] of perPost) {
      t.impressions += vals.impressions;
      t.engaged_users += vals.engaged_users;
      t.reactions += vals.reactions;
      t.comments += vals.comments;
      t.shares += vals.shares;
    }
    return t;
  }, [perPost]);

  return (
    <main>
      <h2>Performance (sidste {sinceDays} dage)</h2>

      <div style={{ display:'flex', gap:8, alignItems:'center', margin: '8px 0 16px' }}>
        <label>Vis periode:</label>
        <select value={sinceDays} onChange={e=>setSinceDays(Number(e.target.value))}>
          <option value={7}>7 dage</option>
          <option value={14}>14 dage</option>
          <option value={30}>30 dage</option>
          <option value={90}>90 dage</option>
        </select>
        {loading && <span>Loader…</span>}
      </div>

      {status && <p>{status}</p>}

      {!status && (
        <>
          {/* Toplinje-kort */}
          <section style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', marginBottom:16 }}>
            <div style={{ border:'1px solid #ddd', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:12, color:'#555' }}>Impressions</div>
              <div style={{ fontSize:22, fontWeight:600 }}>{topline.impressions}</div>
            </div>
            <div style={{ border:'1px solid #ddd', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:12, color:'#555' }}>Engaged</div>
              <div style={{ fontSize:22, fontWeight:600 }}>{topline.engaged_users}</div>
            </div>
            <div style={{ border:'1px solid #ddd', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:12, color:'#555' }}>Reaktioner</div>
              <div style={{ fontSize:22, fontWeight:600 }}>{topline.reactions}</div>
            </div>
            <div style={{ border:'1px solid #ddd', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:12, color:'#555' }}>Kommentarer</div>
              <div style={{ fontSize:22, fontWeight:600 }}>{topline.comments}</div>
            </div>
            <div style={{ border:'1px solid #ddd', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:12, color:'#555' }}>Delinger</div>
              <div style={{ fontSize:22, fontWeight:600 }}>{topline.shares}</div>
            </div>
          </section>

          {/* Tabel pr. post */}
          <section>
            <h3 style={{ margin: '12px 0' }}>Opslag (summeret)</h3>
            {posts.length === 0 ? (
              <p>Ingen opslag endnu.</p>
            ) : (
              <table style={{ borderCollapse:'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={th}>Opslag</th>
                    <th style={th}>Impressions</th>
                    <th style={th}>Engaged</th>
                    <th style={th}>Reaktioner</th>
                    <th style={th}>Kommentarer</th>
                    <th style={th}>Delinger</th>
                    <th style={th}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(p => {
                    const t = perPost.get(p.id) ?? emptyTotals();
                    return (
                      <tr key={p.id}>
                        <td style={td}>{p.title || '(uden titel)'}</td>
                        <td style={tdRight}>{t.impressions}</td>
                        <td style={tdRight}>{t.engaged_users}</td>
                        <td style={tdRight}>{t.reactions}</td>
                        <td style={tdRight}>{t.comments}</td>
                        <td style={tdRight}>{t.shares}</td>
                        <td style={td}>
                          <a href={`/posts/${p.id}/edit`}>Åbn</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const th: React.CSSProperties = { textAlign:'left', padding:6, borderBottom:'1px solid #ddd', fontWeight:600 };
const td: React.CSSProperties = { padding:6, borderBottom:'1px solid #eee' };
const tdRight: React.CSSProperties = { ...td, textAlign:'right' };
