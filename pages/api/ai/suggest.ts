import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  bumpUsage,
  nextResetAtISO,
  type UsagePeriod,
  type Plan,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // --- Auth ---
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // --- Plan & usage gate ---
    const plan = await getUserPlan(email) as Plan;
    const feature = 'text_suggestions' as const;

    const rule = LIMITS[feature][plan];
    const period: UsagePeriod = rule.period;
    const limit = rule.max === Infinity ? null : rule.max;

    const used = await getUsage(email, feature, period);

    if (limit !== null && used >= limit) {
      return res.status(429).json({
        ok: false,
        reason: 'limit_reached',
        plan,
        feature,
        used,
        limit,
        period,
        next_reset_at: nextResetAtISO(period),
      });
    }

    // --- Generate (stub) ---
    const { topic, post_body, tone } = (req.body || {}) as {
      topic?: string; post_body?: string; tone?: string;
    };

    const baseIdeas = [
      'Prøv vores nye croissant – friskbagt i morges 🥐☕️',
      'Ugens kage: lemon meringue – hvad siger I? 🍋',
      'Hyggehjørne klar til eftermiddagskaffe – kig forbi!',
    ];

    const suggestions =
      post_body && post_body.trim()
        ? [`${post_body.trim()} ${tone === 'tilbud' ? '💥' : '✨'} #café #lokalt`]
        : baseIdeas.map(s => tone === 'tilbud' ? `${s} – i dag -10% til kl. 16!` : s);

    // Tæl forbruget efter succes
    try { await bumpUsage(email, feature, period); } catch {}

    return res.status(200).json({ ok: true, suggestions });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
