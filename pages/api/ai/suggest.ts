// pages/api/ai/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  bumpUsage,
  nextResetAtISO,
} from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // Auth -> email
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // Plan & limits for denne feature
    const plan = await getUserPlan(email);
    const feature = 'text_suggestions' as const;
    const cfg = LIMITS[feature][plan];
    const period = cfg.period;
    const limit: number | null = Number.isFinite(cfg.max) ? (cfg.max as number) : null;

    // Usage gate
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

    // ----- (Stub) generér forslag -----
    const { topic, post_body, tone } = (req.body || {}) as {
      topic?: string;
      post_body?: string;
      tone?: string;
    };

    const baseIdeas = [
      'Prøv vores nye croissant – friskbagt i morges 🥐☕️',
      'Ugens kage: lemon meringue – hvad siger I? 🍋',
      'Hyggehjørne klar til eftermiddagskaffe – kig forbi!',
    ];

    const suggestions =
      post_body
        ? [`${post_body.trim()} ${tone === 'tilbud' ? '💥' : '✨'} #café #lokalt`]
        : baseIdeas.map((s) => (tone === 'tilbud' ? `${s} – i dag -10% til kl. 16!` : s));

    // Bump usage (ignorer fejl)
    await bumpUsage(email, feature, period);

    return res.status(200).json({ ok: true, suggestions });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
