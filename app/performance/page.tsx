'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = { channel: string; metric: string; value: number; observed_at: string };

type Totals = { [key: string]: number }; // key = `${channel}:${metric}`

export default function PerformancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from('posts_metrics')
        .select('channel, metric, value, observed_at')
        .gte('observed_at', since.toISOString());
      if (error) setError(error.message);
      else setRows((data || []) as Row[]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const t: Totals = {};
    for (const r of rows) {
      const k = `${r.channel}:${r.metric}`;
      t[k] = (t[k] || 0) + Number(r.value || 0);
    }
    setTotals(t);
  }, [rows]);

  const keys = Object.keys(totals).sort();

  return (
    <main>
      <h2>Performance (sidste 30 dage)</h2>
      {loading && <p>Henter...</p>}
      {error && <p>Fejl: {error}</p>}
      {!loading && keys.length === 0 && <p>Ingen målinger endnu. Tip: Send KPI’er ind via Make.</p>}
      {keys.length > 0 && (
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:6, borderBottom:'1px solid #ddd' }}>Kanal</th>
              <th style={{ textAlign:'left', padding:6, borderBottom:'1px solid #ddd' }}>Metrik</th>
              <th style={{ textAlign:'right', padding:6, borderBottom:'1px solid #ddd' }}>Sum (30d)</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => {
              const [channel, metric] = k.split(':');
              return (
                <tr key={k}>
                  <td style={{ padding:6 }}>{channel}</td>
                  <td style={{ padding:6 }}>{metric}</td>
                  <td style={{ padding:6, textAlign:'right' }}>{totals[k]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
