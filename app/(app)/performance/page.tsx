// app/(app)/performance/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type SummaryPayload = {
  ok: true;
  periodDays: number;
  totals: Record<string, number>;
  byDay: Array<{ date: string; [metric: string]: any }>;
  bestHourUTC: number | null;
  topPosts: Array<{ id: number; title: string | null; impressions: number }>;
};

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [days, setDays] = useState(30);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setErr('Du er ikke logget ind.'); setLoading(false); return; }

      const resp = await fetch(`/api/metrics/summary?days=${days}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!resp.ok) {
        setErr('Kunne ikke hente KPI: ' + (await resp.text()));
        setLoading(false);
        return;
      }
      const json = (await resp.json()) as SummaryPayload;
      setData(json);
    } catch (e: any) {
      setErr(e.message || 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* on mount */ }, []);
  useEffect(() => { load(); /* when days changes */ }, [days]);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '8px 0' }}>
      <h2 style={{ marginBottom: 8 }}>Performance</h2>

      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom: 12 }}>
        <span>Periode:</span>
        <select value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 dage</option>
          <option value={30}>30 dage</option>
          <option value={60}>60 dage</option>
          <option value={90}>90 dage</option>
        </select>
        <button onClick={load} disabled={loading}>{loading ? 'Henter…' : 'Opdater'}</button>
        <Link href="/posts" style={{ marginLeft: 'auto' }}>Dine opslag</Link>
      </div>

      {err && (
        <p style={{ color: '#b00', marginBottom: 12 }}>{err}</p>
      )}

      {!err && loading && (
        <p style={{ marginBottom: 12 }}>Henter KPI…</p>
      )}

      {!loading && !err && data && (
        <>
          {/* Top metrics (kort) */}
          <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
            <KpiCard label="Visninger (impressions)" value={fmt(data.totals.impressions)} />
            <KpiCard label="Engagement (engaged_users)" value={fmt(data.totals.engaged_users)} />
            <KpiCard label="Likes/reactions" value={fmt((data.totals.reactions || 0) + (data.totals.likes || 0))} />
            <KpiCard label="Kommentarer" value={fmt(data.totals.comments)} />
            <KpiCard label="Delinger" value={fmt(data.totals.shares)} />
          </section>

          {/* Best hour */}
          <section style={{ marginBottom: 16, padding: 12, border: '1px solid #eee', borderRadius: 12 }}>
            <h3 style={{ margin: 0, marginBottom: 6 }}>Bedste tidspunkt</h3>
            {data.bestHourUTC === null ? (
              <p>Ingen data endnu.</p>
            ) : (
              <p>Flest visninger omkring kl. <strong>{pad2(data.bestHourUTC)}:00 (UTC)</strong>.</p>
            )}
            <p style={{ color:'#555', marginTop: 6 }}>Tip: Når du har mere data, kan vi oversætte til lokal tid (CEST/CET).</p>
          </section>

          {/* By day table */}
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 6 }}>Udvikling pr. dag</h3>
            {data.byDay.length === 0 ? (
              <p>Ingen KPI endnu – lav et opslag eller kør din Make-synk.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      <Th>Dato</Th>
                      <Th>Impressions</Th>
                      <Th>Engaged</Th>
                      <Th>Reactions+Likes</Th>
                      <Th>Comments</Th>
                      <Th>Shares</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.map((d) => (
                      <tr key={d.date}>
                        <Td>{d.date}</Td>
                        <Td>{fmt((d as any).impressions)}</Td>
                        <Td>{fmt((d as any).engaged_users)}</Td>
                        <Td>{fmt(((d as any).reactions || 0) + ((d as any).likes || 0))}</Td>
                        <Td>{fmt((d as any).comments)}</Td>
                        <Td>{fmt((d as any).shares)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Top posts */}
          <section style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 6 }}>Top-opslag (impressions)</h3>
            {data.topPosts.length === 0 ? (
              <p>Ingen opslag med KPI endnu.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {data.topPosts.map(p => (
                  <li key={p.id} style={{ marginBottom: 4 }}>
                    <Link href={`/posts/${p.id}/edit`}>{p.title || '(uden titel)'}</Link>
                    {' — '}
                    <span style={{ color:'#555' }}>{fmt(p.impressions)} visninger</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd', fontWeight: 600 }}>{children}</th>;
}
function Td({ children }: { children: any }) {
  return <td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{children}</td>;
}
function fmt(n?: number) {
  const v = Number(n || 0);
  return v.toLocaleString('da-DK');
}
function pad2(n: number) {
  return n < 10 ? '0' + n : String(n);
}
