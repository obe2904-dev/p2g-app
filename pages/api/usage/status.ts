import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  nextResetAtISO,
} from '@/lib/plan';

type Plan = 'free' | 'basic' | 'pro' | 'premium';
type Period = 'day' | 'week' | 'month';

function planRules(plan: Plan): { period: Period; limit: number | null } {
  // Samme logik som i suggest.ts
  switch (plan) {
    case 'free':
      return { period: 'week', limit: 3 };
    case 'pro':
      return { period: 'day', limit: 3 };
    case 'premium':
      return { period: 'day', limit: null }; // ubegrænset
    case 'basic':
    default:
      return { period: 'day', limit: null }; // ubegrænset
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = await getUserPlan(email) as Plan;
    const { period, limit } = planRules(plan);

    // Vi rapporterer status for feature "text_suggestions"
    const used = await getUsage(email, 'text_suggestions', period);

    const payload = {
      ok: true,
      feature: 'text_suggestions',
      plan,
      period,
      used,
      limit, // kan være null (ubegraenset)
      remaining: limit === null ? null : Math.max(0, limit - used),
      resetAtISO: nextResetAtISO(period),
    };

    return res.status(200).json(payload);
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
