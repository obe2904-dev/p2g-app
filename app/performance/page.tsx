// app/performance/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type MetricRow = {
  metric: string;
  value: number | string; // Supabase numeric kan komme som string
  channel: string;
  observed_at: string;
};

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [byChannel, setByChannel] = useState<Record<string, Record<string, number>>>({});
  const [sinceIso, setSinceIso] = useState<string>('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      // Sidste 30 dage
      const since = new Date();
      since.setDate(since.getDate() - 30);
      since.setHours(0, 0, 0, 0);
      setSinceIso(since.toISOString());

      const { data, error } = await supabase
        .from('posts_metrics')
        .select('metric, value, channel, observed_at')
        .gte('observed_at', since.toISOString())
        .order('observed_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as MetricRow[];
      const t: Record<string, number> = {};
      const bc: Record<string, Record<string, number>> = {};

      for (const r of rows) {
        const metric = r.metric || 'ukendt';
        const channel = r.channel || 'ukendt';
        const val = typeof r.value === 'string' ? Number(r.value) : (r.value ?? 0);
        const safe = Number.isFinite(val) ? val : 0;

        // total pr. metric
        t[metric] = (t[metric] || 0) + safe;

        // pr. kanal pr. metric
        if (!bc[channel]) bc[channel] = {};
        bc[channel][metric] = (bc[channel][metric] || 0) + safe;
      }

      setTotals(t);
      setByChannel(bc);
    } catch (e: any) {
      setErr(e.message || 'Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  }

  const metricKeys = Object.keys(totals).sort();
  const channelKeys = Object.keys(byChannel).sort();

  return (
    <RequireAuth>
      <main>
        <h2>Performance (sidste 30 dage)</h2>
        <p style={{ color: '#555', marginTop: 4 }}>Periode fra: {sinceIso ? new Date(sinceIso).toLocaleDateString() : '—'}</p>

        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <button onClick={load} disabled={loading}>{loading ? 'Opdaterer…' : 'Opdatér'}</button>
        </div>

        {err && <p style={{ color: '#b00' }}>Fejl: {err}</p>}
        {loading && <p>Henter…</p>}

        {!loading && metricKeys.length === 0 && (
          <p>Ingen målinger endnu. Når dine opslag begynder at få data, dukker de op her.</p>
        )}

        {/* Totaler pr. metric */}
        {!loading && metricKeys.length > 0 && (
          <section style={{ marginTop: 12 }}>
            <h3>Overblik</h3>
            <table style={{ borderCollapse: 'collapse', minWidth: 360 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #ddd' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {metricKeys.map((m) => (
                  <tr key={m}>
                    <td style={{ padding: 6 }}>{m}</td>
                    <td style={{ padding: 6, textAlign: 'right' }}>{Math.round((totals[m] + Number.EPSILON) * 100) / 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Fordeling pr. kanal */}
        {!loading && channelKeys.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h3>Fordeling pr. kanal</h3>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {channelKeys.map((ch) => {
                const metrics = byChannel[ch] || {};
                const mKeys = Object.keys(metrics).sort();
                return (
                  <div key={ch} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                    <strong style={{ display: 'block', marginBottom: 6 }}>{ch}</strong>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Metric</th>
                          <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #ddd' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mKeys.map((m) => (
                          <tr key={m}>
                            <td style={{ padding: 6 }}>{m}</td>
                            <td style={{ padding: 6, textAlign: 'right' }}>{Math.round((metrics[m] + Number.EPSILON) * 100) / 100}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
