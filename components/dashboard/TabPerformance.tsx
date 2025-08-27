'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Card from './Card';

type MetricRow = {
  post_id: number;
  channel: string;
  metric: string;
  value: number;
  observed_at: string;
};

type PostInfo = { id: number; title: string | null };

export default function TabPerformance() {
  const [rows7d, setRows7d] = useState<MetricRow[]>([]);
  const [rows30d, setRows30d] = useState<MetricRow[]>([]);
  const [posts, setPosts] = useState<Record<number, PostInfo>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const since7dISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const since30dISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr(null);

        // 7 dage (alt)
        const { data: a, error: aErr } = await supabase
          .from('posts_metrics')
          .select('post_id,channel,metric,value,observed_at')
          .gte('observed_at', since7dISO);
        if (aErr) throw aErr;
        setRows7d((a || []) as MetricRow[]);

        // 30 dage (til topopslag)
        const { data: b, error: bErr } = await supabase
          .from('posts_metrics')
          .select('post_id,channel,metric,value,observed_at')
          .gte('observed_at', since30dISO);
        if (bErr) throw bErr;
        const r30 = (b || []) as MetricRow[];
        setRows30d(r30);

        // Hent post-titler for de IDs vi viser (fra 30d)
        const ids = Array.from(new Set(r30.map(r => r.post_id)));
        if (ids.length) {
          const { data: p, error: pErr } = await supabase
            .from('posts_app')
            .select('id,title')
            .in('id', ids);
          if (pErr) throw pErr;
          const map: Record<number, PostInfo> = {};
          (p || []).forEach((row: any) => { map[row.id] = { id: row.id, title: row.title }; });
          setPosts(map);
        } else {
          setPosts({});
        }
      } catch (e:any) {
        setErr(e.message || 'Kunne ikke hente KPI-data');
      } finally {
        setLoading(false);
      }
    })();
  }, [since7dISO, since30dISO]);

  // Aggreger — 7 dage totals
  const totals7d = useMemo(() => {
    const sum: Record<string, number> = {};
    rows7d.forEach(r => {
      sum[r.metric] = (sum[r.metric] || 0) + Number(r.value || 0);
    });
    return {
      impressions: sum['impressions'] || 0,
      engaged_users: sum['engaged_users'] || 0,
      likes: sum['likes'] || 0,
      comments: sum['comments'] || 0,
      shares: sum['shares'] || 0,
      saves: sum['saves'] || 0,
      clicks: sum['clicks'] || 0,
    };
  }, [rows7d]);

  // Aggreger — 7 dage per kanal (impressions/engaged)
  const byChannel7d = useMemo(() => {
    const map: Record<string, { impressions: number; engaged: number }> = {};
    rows7d.forEach(r => {
      const m = map[r.channel] || { impressions: 0, engaged: 0 };
      if (r.metric === 'impressions') m.impressions += Number(r.value || 0);
      if (r.metric === 'engaged_users') m.engaged += Number(r.value || 0);
      map[r.channel] = m;
    });
    return map;
  }, [rows7d]);

  // Topopslag (30 dage) — sortér efter impressions
  const topPosts30d = useMemo(() => {
    const byPost: Record<number, number> = {};
    rows30d.forEach(r => {
      if (r.metric === 'impressions') {
        byPost[r.post_id] = (byPost[r.post_id] || 0) + Number(r.value || 0);
      }
    });
    const sorted = Object.entries(byPost)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(([post_id, imp]) => ({ post_id: Number(post_id), impressions: imp }));
    return sorted;
  }, [rows30d]);

  return (
    <section style={{ display:'grid', gap: 12 }}>
      {err && <p style={{ color:'#b00' }}>{err}</p>}

      {/* Overblik 7 dage */}
      <Card title="Performance (7 dage)">
        {loading ? 'Henter…' : (
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))' }}>
            <Kpi label="Visninger" value={totals7d.impressions} />
            <Kpi label="Engaged users" value={totals7d.engaged_users} />
            <Kpi label="Likes" value={totals7d.likes} />
            <Kpi label="Kommentarer" value={totals7d.comments} />
            <Kpi label="Delinger" value={totals7d.shares} />
          </div>
        )}
      </Card>

      {/* Kanaler 7 dage */}
      <Card title="Kanaler (7 dage)">
        {loading ? 'Henter…' : (
          <div style={{ display:'grid', gap:8 }}>
            {Object.keys(byChannel7d).length === 0 && <div>Ingen data endnu.</div>}
            {Object.entries(byChannel7d).map(([ch, v]) => (
              <div key={ch} style={{ display:'flex', justifyContent:'space-between', border:'1px solid #eee', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ fontWeight:600 }}>{ch}</div>
                <div style={{ fontSize:13, color:'#555' }}>
                  Visninger: <strong>{Math.round(v.impressions).toLocaleString('da-DK')}</strong> ·
                  {' '}Engaged: <strong>{Math.round(v.engaged).toLocaleString('da-DK')}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Topopslag 30 dage */}
      <Card title="Topopslag (30 dage)">
        {loading ? 'Henter…' : (
          <div style={{ display:'grid', gap:8 }}>
            {topPosts30d.length === 0 && <div>Ingen data endnu.</div>}
            {topPosts30d.map(row => {
              const p = posts[row.post_id];
              return (
                <div key={row.post_id} style={{ display:'flex', justifyContent:'space-between', border:'1px solid #eee', borderRadius:8, padding:'8px 10px' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{p?.title || '(uden titel)'}</div>
                    <div style={{ fontSize:12, color:'#666' }}>#{row.post_id}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700 }}>{Math.round(row.impressions).toLocaleString('da-DK')}</div>
                    <div style={{ fontSize:12, color:'#666' }}>visninger</div>
                    <Link href={`/posts/${row.post_id}/edit`} style={{ fontSize:12, marginLeft:12 }}>Redigér →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
      <div style={{ fontSize:12, color:'#666', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700 }}>{Math.round(value).toLocaleString('da-DK')}</div>
    </div>
  );
}
