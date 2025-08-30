// pages/api/metrics/summary.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { admin } from '@/lib/plan';

type Row = {
  post_id: number;
  channel: string;
  metric: string;   // fx impressions, likes, comments, shares, engaged_users
  value: any;       // Supabase "numeric" kan komme som string – vi caster til number
  observed_at: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    // --- Auth (Bearer <token>) ---
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user?.email) return res.status(401).send('Invalid token');
    const email = u.user.email!;

    // --- Input ---
    const daysParam = Number(req.query.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(90, daysParam) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // --- Fetch KPI-rækker for brugeren ---
    const { data, error } = await admin
      .from('posts_metrics')
      .select('post_id, channel, metric, value, observed_at')
      .eq('user_email', email)
      .gte('observed_at', since)
      .order('observed_at', { ascending: false });

    const rows = (data || []) as Row[];
    if (error) return res.status(500).send(error.message);

    // --- Aggregeringer ---
    const totals: Record<string, number> = {};             // sum per metric
    const byDayMap: Record<string, Record<string, number>> = {}; // "YYYY-MM-DD" -> metric -> sum
    const hourImpressions: number[] = new Array(24).fill(0);      // impressions pr. time
    const postImpressions: Record<number, number> = {};    // post_id -> sum impressions

    // Gennemløb data
    for (const r of rows) {
      const v = Number(r.value ?? 0) || 0;

      // totals pr. metric (alle kanaler/ops)
      totals[r.metric] = (totals[r.metric] || 0) + v;

      // per dag
      const d = new Date(r.observed_at);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      byDayMap[key] = byDayMap[key] || {};
      byDayMap[key][r.metric] = (byDayMap[key][r.metric] || 0) + v;

      // bedst time → basér på impressions (hvis til stede)
      if (r.metric === 'impressions') {
        hourImpressions[d.getUTCHours()] += v;
        postImpressions[r.post_id] = (postImpressions[r.post_id] || 0) + v;
      }
    }

    // per-dag som liste, sorteret stigende
    const byDay = Object.keys(byDayMap)
      .sort()
      .map(date => ({ date, ...byDayMap[date] }));

    // top-opsalg (efter impressions) – hent titler
    const topIds = Object.entries(postImpressions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => Number(id));

    let titles: Record<number, string | null> = {};
    if (topIds.length) {
      const { data: posts } = await admin
        .from('posts_app')
        .select('id, title')
        .in('id', topIds);
      for (const p of posts || []) titles[p.id] = p.title ?? null;
    }

    const topPosts = topIds.map(id => ({
      id,
      title: titles[id] ?? '(uden titel)',
      impressions: postImpressions[id] || 0,
    }));

    // bedst time (UTC) – find index med max
    let bestHourUTC: number | null = null;
    let bestHourValue = -1;
    for (let h = 0; h < 24; h++) {
      if (hourImpressions[h] > bestHourValue) {
        bestHourValue = hourImpressions[h];
        bestHourUTC = h;
      }
    }

    return res.status(200).json({
      ok: true,
      periodDays: days,
      totals,     // fx { impressions: 1200, likes: 30, comments: 4, ... }
      byDay,      // [{ date: '2025-08-28', impressions: 200, likes: 5, ... }, ...]
      bestHourUTC, // 0-23 eller null hvis ingen impressions
      topPosts,   // [{ id, title, impressions }, ...]
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
