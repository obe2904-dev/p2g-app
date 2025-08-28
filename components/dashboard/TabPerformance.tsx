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

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  useEffect(() => {
    (async () => {
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
      }
    })();
  }, [sinceISO]);

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <Card title="Performance (sidste 30 dage)">
        {loading && <p>Henter…</p>}
        {err && <p style={{ color:'#b00' }}>{err}</p>}
        {!loading && !err && rows.length === 0 && <p>Ingen målinger endnu.</p>}
        {!loading && !err && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse:'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Post</th>
                  <th style={th}>Kanal</th>
                  <th style={th, {textAlign:'right'} as any}>Impr.</th>
                  <th style={th, {textAlign:'right'} as any}>Likes</th>
                  <th style={th, {textAlign:'right'} as any}>Comments</th>
                  <th style={th, {textAlign:'right'} as any}>Shares</th>
                  <th style={th}>Sidst set</th>
                </tr>
              </thead>
              <tbody>
                {rows.sort((a,b)=> new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
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

const th: React.CSSProperties = {
  textAlign:'left',
  padding:8,
  borderBottom:'1px solid #eee',
  fontWeight:600,
  fontSize:13
};
const td: React.CSSProperties = { padding:8, borderBottom:'1px solid #f3f3f3', fontSize:13 };
const fmt = (n:number) => new Intl.NumberFormat('da-DK').format(Math.round(n));
