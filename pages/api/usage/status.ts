// pages/api/usage/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  nextResetAtISO,
  type Plan,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = (await getUserPlan(email)) as Plan;
    const feature = 'text_suggestions' as const;
    const rule = LIMITS[feature][plan];
    const period = rule.period;
    const limit  = rule.max; // number | Infinity

    const used = await getUsage(email, feature, period);

    return res.status(200).json({
      ok: true,
      feature,
      plan,
      period,
      used,
      limit: Number.isFinite(limit) ? limit : null,
      remaining: Number.isFinite(limit) ? Math.max(0, (limit as number) - used) : null,
      resetAtISO: nextResetAtISO(period),
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
