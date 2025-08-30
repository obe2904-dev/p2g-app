import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  nextResetAtISO,
  LIMITS,
  type Plan,
  type UsagePeriod,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = await getUserPlan(email) as Plan;
    const feature = 'text_suggestions' as const;

    const rule = LIMITS[feature][plan];
    const period: UsagePeriod = rule.period;
    const limit = rule.max === Infinity ? null : rule.max;

    const used = await getUsage(email, feature, period);

    return res.status(200).json({
      ok: true,
      feature,
      plan,
      period,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      resetAtISO: nextResetAtISO(period),
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
