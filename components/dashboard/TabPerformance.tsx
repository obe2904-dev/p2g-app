'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Card from './Card';

type MetricRow = {
  post_id: number;
  channel: string;
  metric: string;
  value: number;
  observed_at: string;
};

type PostTitle = { id: number; title: string | null };

type Summary = {
  post_id: number;
  channel: string;
  last_seen: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  title?: string | null;
};

export default function TabPerformance() {
  // ---- UI state (filtre) ----
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [showFB, setShowFB] = useState(true);
  const [showIG, setShowIG] = useState(true);

  // ---- Data state ----
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr(null);

        // 1) Hent KPI-rækker for valgt periode
        const { data, error } = await supabase
          .from('posts_metrics')
          .select('post_id, channel, metric, value, observed_at')
          .gte('observed_at', sinceISO)
          .order('observed_at', { ascending: false });

        if (error) throw new Error(error.message);
        const metrics = (data || []) as MetricRow[];

        // 2) Aggreger pr. post_id + kanal
        const map = new Map<string, Summary>();
        for (const r of metrics) {
          const key = `${r.post_id}|${r.channel}`;
          const cur = map.get(key) || {
            post_id: r.post_id,
            channel: r.channel,
            last_seen: r.observed_at,
            impressions: 0,
            likes: 0,
            comments: 0,
            shares: 0,
          };
          if (new Date(r.observed_at) > new Date(cur.last_seen)) cur.last_seen = r.observed_at;
          if (r.metric === 'impressions') cur.impressions += Number(r.value || 0);
          if (r.metric === 'likes')       cur.likes       += Number(r.value || 0);
          if (r.metric === 'comments')    cur.comments    += Number(r.value || 0);
          if (r.metric === 'shares')      cur.shares      += Number(r.value || 0);
          map.set(key, cur);
        }
        const summaries = Array.from(map.values());

        // 3) Slå titler op
        const ids = Array.from(new Set(summaries.map(s => s.post_id)));
        if (ids.length) {
          const { data: posts, error: pErr } = await supabase
            .from('posts_app')
            .select('id, title')
            .in('id', ids);

          if (pErr) throw new Error(pErr.message);
          const titleMap = new Map<number, string | null>(
            (posts || []).map(p => [p.id, (p as PostTitle).title])
          );
          for (const s of summaries) s.title = titleMap.get(s.post_id) ?? null;
        }

        setRows(summaries);
      } catch (e: any) {
        setErr(e.message || 'Kunne ikke hente performance-data');
      } finally {
        setLoading(false);
      }
    })();
  }, [sinceISO]);

  // ---- Filtrering & totals ----
  const filtered = rows.filter(r =>
    (showFB && r.channel === 'facebook') ||
    (showIG && r.channel === 'instagram') ||
    (!showFB && !showIG) // hvis alt er slået fra, vis ingenting
  );

  const totals = filtered.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.likes += r.likes;
      acc.comments += r.comments;
      acc.shares += r.shares;
      return acc;
    },
    { impressions: 0, likes: 0, comments: 0, shares: 0 }
  );

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      {/* KPI-kort */}
      <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))' }}>
        <MiniCard label="Impressions" value={fmt(totals.impressions)} />
        <MiniCard label="Likes" value={fmt(totals.likes)} />
        <MiniCard label="Comments" value={fmt(totals.comments)} />
        <MiniCard label="Shares" value={fmt(totals.shares)} />
      </div>

      {/* Tabel + filtre i headerRight */}
      <Card
        title={`Performance (sidste ${periodDays} dage)`}
        headerRight={
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6, fontSize:12, color:'#555' }}>
              <label>
                <input type="checkbox" checked={showFB} onChange={e=>setShowFB(e.target.checked)} /> Facebook
              </label>
              <label>
                <input type="checkbox" checked={showIG} onChange={e=>setShowIG(e.target.checked)} /> Instagram
              </label>
            </div>
            <select
              value={periodDays}
              onChange={e=>setPeriodDays(Number(e.target.value) as 7|30|90)}
              style={{ fontSize:12 }}
            >
              <option value={7}>7 dage</option>
              <option value={30}>30 dage</option>
              <option value={90}>90 dage</option>
            </select>
          </div>
        }
      >
        {loading && <p>Henter…</p>}
        {err && <p style={{ color:'#b00' }}>{err}</p>}
        {!loading && !err && filtered.length === 0 && <p>Ingen målinger for valgte filtre.</p>}
        {!loading && !err && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse:'collapse', minWidth: 720, width:'100%' }}>
              <thead>
                <tr>
                  <th style={th}>Post</th>
                  <th style={th}>Kanal</th>
                  <th style={{ ...th, textAlign:'right' }}>Impr.</th>
                  <th style={{ ...th, textAlign:'right' }}>Likes</th>
                  <th style={{ ...th, textAlign:'right' }}>Comments</th>
                  <th style={{ ...th, textAlign:'right' }}>Shares</th>
                  <th style={th}>Sidst set</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .sort((a,b)=> new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
                  .map((r, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <a href={`/posts/${r.post_id}/edit`} style={{ textDecoration:'none', color:'#111' }}>
                        #{r.post_id} {r.title ? '— ' + r.title : ''}
                      </a>
                    </td>
                    <td style={td}>{r.channel}</td>
                    <td style={{ ...td, textAlign:'right' }}>{fmt(r.impressions)}</td>
                    <td style={{ ...td, textAlign:'right' }}>{fmt(r.likes)}</td>
                    <td style={{ ...td, textAlign:'right' }}>{fmt(r.comments)}</td>
                    <td style={{ ...td, textAlign:'right' }}>{fmt(r.shares)}</td>
                    <td style={td}>{new Date(r.last_seen).toLocaleString('da-DK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

/* ---- små hjælpekomponenter/styles ---- */

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border:'1px solid #eee', borderRadius:12, padding:12, background:'#fff',
      boxShadow:'0 1px 2px rgba(0,0,0,0.03)'
    }}>
      <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, lineHeight:1.1 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign:'left',
  padding:8,
  borderBottom:'1px solid #eee',
  fontWeight:600,
  fontSize:13
};
const td: React.CSSProperties = { padding:8, borderBottom:'1px solid #f3f3f3', fontSize:13 };
const fmt = (n:number) => new Intl.NumberFormat('da-DK').format(Math.round(n));
