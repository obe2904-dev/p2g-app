import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  nextResetAtISO,
} from '@/lib/plan';

type Plan = 'free' | 'basic' | 'pro' | 'premium';
type Period = 'day' | 'week' | 'month';

// Samme simple regler som i suggest.ts
function planRules(plan: Plan): { period: Period; limit: number | null } {
  switch (plan) {
    case 'free':
      // Gratis: 3 pr. uge
      return { period: 'week', limit: 3 };
    case 'pro':
      // Pro: 3 pr. dag
      return { period: 'day', limit: 3 };
    case 'premium':
      // Premium: ubegrænset (fair use)
      return { period: 'day', limit: null };
    case 'basic':
    default:
      // Basic: ubegrænset (manual copy/paste-setup)
      return { period: 'day', limit: null };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    // Bearer-token -> e-mail
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // Plan & regler
    const plan = (await getUserPlan(email)) as Plan;
    const { period, limit } = planRules(plan);

    // Feature: text_suggestions
    // getUsage returnerer et tal (antal brugt i den aktuelle periode)
    const used: number = await getUsage(email, 'text_suggestions', period);

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
