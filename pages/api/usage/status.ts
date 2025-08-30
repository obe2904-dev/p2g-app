import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserEmailFromToken, getUserPlan, LIMITS, getUsage, nextResetAtISO, planLabelShort } from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const feature = String(req.query.feature || '');
  if (!feature) return res.status(400).send('Missing feature');
  const email = await getUserEmailFromToken(req.headers.authorization || null);
  if (!email) return res.status(401).send('Missing/invalid token');

  const plan = await getUserPlan(email);
  const cfg = (LIMITS as any)[plan]?.[feature];
  if (!cfg) return res.status(404).send('Unknown feature');

  const used = await getUsage(email, feature, cfg.period);
  const limit = cfg.limit; // number | null
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return res.status(200).json({
    plan,
    plan_label: planLabelShort(plan),
    feature,
    period: cfg.period,
    limit,
    used,
    remaining,
    resetAt: nextResetAtISO(cfg.period)
  });
}
