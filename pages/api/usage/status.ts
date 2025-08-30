// pages/api/usage/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  nextResetAtISO,
  LIMITS,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = await getUserPlan(email);
    const feature = 'text_suggestions' as const;
    const cfg = LIMITS[feature][plan];
    const period = cfg.period;
    const limit: number | null = Number.isFinite(cfg.max) ? (cfg.max as number) : null;

    const used = await getUsage(email, feature, period);

    return res.status(200).json({
      ok: true,
      feature,
      plan,
      period,
      used,
      limit: limit ?? null,
      remaining: limit === null ? null : Math.max(0, (limit as number) - used),
      resetAtISO: nextResetAtISO(period),
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
