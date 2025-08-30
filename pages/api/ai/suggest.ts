import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  bumpUsage,
  nextResetAtISO,
} from '@/lib/plan';

type Plan = 'free' | 'basic' | 'pro' | 'premium';
type Period = 'day' | 'week' | 'month';

// Samme simple regler som i status-endpointet
function planRules(plan: Plan): { period: Period; limit: number | null } {
  switch (plan) {
    case 'free':
      return { period: 'week', limit: 3 };   // 3/uge
    case 'pro':
      return { period: 'day', limit: 3 };    // 3/dag
    case 'premium':
      return { period: 'day', limit: null }; // ubegrænset (fair use)
    case 'basic':
    default:
      return { period: 'day', limit: null }; // ubegrænset (manual copy/paste)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // --- Auth ---
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // --- Plan & usage gate ---
    const plan = (await getUserPlan(email)) as Plan;
    const { period, limit } = planRules(plan);
    const feature = 'text_suggestions';

    // getUsage returnerer et objekt -> destrukturer used
    const usageObj = await getUsage(email, feature, period);
    const used = typeof (usageObj as any) === 'number'
      ? Number(usageObj)
      : Number((usageObj as any).used || 0);

    if (limit !== null && used >= limit) {
      return res.status(429).json({
        ok: false,
        reason: 'limit_reached',
        plan,
        feature,
        used,
        limit,
        period,
        next_reset_at: (usageObj as any).period_end || nextResetAtISO(period),
      });
    }

    // --- Læs body ---
    const { topic, post_body, tone } = (req.body || {}) as {
      topic?: string;
      post_body?: string;
      tone?: string;
    };

    // --- Stubbet generering (erstattes af rigtig AI senere) ---
    const baseIdeas = [
      'Prøv vores nye croissant – friskbagt i morges 🥐☕️',
      'Ugens kage: lemon meringue – hvad siger I? 🍋',
      'Hyggehjørne klar til eftermiddagskaffe – kig forbi!',
    ];

    const suggestions =
      post_body
        ? [`${post_body.trim()} ${tone === 'tilbud' ? '💥' : '✨'} #café #lokalt`]
        : baseIdeas.map((s) => (tone === 'tilbud' ? `${s} – i dag -10% til kl. 16!` : s));

    // --- Bump usage (ignorer evt. fejl) ---
    try { await bumpUsage(email, feature, period); } catch {}

    return res.status(200).json({ ok: true, suggestions });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
