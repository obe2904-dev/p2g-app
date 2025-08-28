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
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  useEffect(() => { load(); }, [sinceISO]);

  async function load() {
    try {
      setLoading(true); setErr(null);

      // 1) Hent KPI-rækker for de sidste 30 dage
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
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Performance (sidste 30 dage)"
        headerRight={
          <button
            onClick={onRefresh}
            disabled={loading || refreshing}
            style={{
              padding: '6px 10px',
              border: '1px solid #111',
              background: (loading || refreshing) ? '#f2f2f2' : '#111',
              color: (loading || refreshing) ? '#999' : '#fff',
              borderRadius: 8,
              cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
              fontSize: 12
            }}
          >
            {refreshing ? 'Opdaterer…' : 'Opdatér'}
          </button>
        }
      >
        {loading && <p>Henter…</p>}
        {err && <p style={{ color:'#b00' }}>{err}</p>}
        {!loading && !err && rows.length === 0 && <p>Ingen målinger endnu.</p>}

        {!loading && !err && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Post</th>
                  <th style={th}>Kanal</th>
                  <th style={thRight}>Impr.</th>
                  <th style={thRight}>Likes</th>
                  <th style={thRight}>Comments</th>
                  <th style={thRight}>Shares</th>
                  <th style={th}>Sidst set</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a,b)=> new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
                  .map((r, i) => (
                  <tr key={i} style={i % 2 ? rowAlt : undefined}>
                    <td style={td}>
                      <a href={`/posts/${r.post_id}/edit`} style={{ textDecoration:'none', color:'#111' }}>
                        #{r.post_id} {r.title ? '— ' + r.title : '— (uden titel)'}
                      </a>
                    </td>
                    <td style={td}>
                      <span style={pill}>{r.channel}</span>
                    </td>
                    <td style={tdRight}>{fmt(r.impressions)}</td>
                    <td style={tdRight}>{fmt(r.likes)}</td>
                    <td style={tdRight}>{fmt(r.comments)}</td>
                    <td style={tdRight}>{fmt(r.shares)}</td>
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

/* ---------- styles ---------- */

const table: React.CSSProperties = {
  borderCollapse:'collapse',
  minWidth: 760,
  width: '100%'
};

const th: React.CSSProperties = {
  textAlign:'left',
  padding:8,
  borderBottom:'1px solid #eee',
  fontWeight:600,
  fontSize:13,
  whiteSpace:'nowrap'
};

const thRight: React.CSSProperties = { ...th, textAlign:'right' };

const td: React.CSSProperties = {
  padding:8,
  borderBottom:'1px solid #f3f3f3',
  fontSize:13,
  verticalAlign:'top'
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign:'right',
  fontVariantNumeric:'tabular-nums' // pæn kolonneopstilling
};

const rowAlt: React.CSSProperties = { background:'#fafafa' };

const pill: React.CSSProperties = {
  display:'inline-block',
  fontSize:11,
  padding:'2px 8px',
  border:'1px solid #e5e5e5',
  borderRadius:999,
  background:'#fff',
  textTransform:'capitalize'
};

const fmt = (n:number) => new Intl.NumberFormat('da-DK').format(Math.round(n));
