import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  nextResetAtISO,
  planLabelShort,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = await getUserPlan(email);

    // ---- Status for de to features vi viser i UI ----
    const features = ['text_suggestions', 'photo_edits'] as const;

    const byFeature = await Promise.all(
      features.map(async (feature) => {
        const { limit, period } = LIMITS[plan][feature];
        if (limit === 'unlimited') {
          return {
            feature,
            limit,
            period,
            used: 0,
            remaining: 'unlimited',
            resetAt: null,
          };
        }
        const usage = await getUsage(email, feature, period);
        const remaining = Math.max(0, limit - usage.used);
        return {
          feature,
          limit,
          period,
          used: usage.used,
          remaining,
          resetAt: nextResetAtISO(period),
        };
      })
    );

    return res.status(200).json({
      ok: true,
      plan,
      planLabel: planLabelShort(plan), // fx 'Gratis', 'Pro'
      features: byFeature,
    });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
