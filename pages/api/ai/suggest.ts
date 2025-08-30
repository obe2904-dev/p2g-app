import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserEmailFromToken, getUserPlan, LIMITS, getUsage, bumpUsage } from '@/lib/plan';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // --- Auth ---
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // --- Plan & usage gate ---
    const plan = await getUserPlan(email);
    const feature = 'text_suggestions';

    // limits[feature] is expected to be like: { limit: number|null, period: 'day'|'week'|'month' }
    const limitsForPlan: any = LIMITS[plan] || {};
    const { limit = null, period = 'week' } = limitsForPlan[feature] || {};

    // getUsage returns { used:number, period_start:string, period_end:string }
    const usage = await getUsage(email, feature, new Date().toISOString());
    const { used, period_end } = usage;

    if (limit !== null && used >= limit) {
      return res.status(429).json({
        ok: false,
        reason: 'limit_reached',
        plan,
        feature,
        used,
        limit,
        period,
        next_reset_at: period_end, // show user when counter resets
      });
    }

    // --- Generate (stubbed) suggestions ---
    const { topic, post_body, tone } = (req.body || {}) as {
      topic?: string;
      post_body?: string;
      tone?: string;
    };

    // Simple stubbed ideas; replace with your real AI call later
    const baseIdeas = [
      'Prøv vores nye croissant – friskbagt i morges 🥐☕️',
      'Ugens kage: lemon meringue – hvad siger I? 🍋',
      'Hyggehjørne klar til eftermiddagskaffe – kig forbi!',
    ];

    const suggestions =
      post_body
        ? [
            // “Improve” the provided text a bit (very light stub)
            `${post_body.trim()} ${tone === 'tilbud' ? '💥' : '✨'} #café #lokalt`,
          ]
        : baseIdeas.map((s) =>
            tone === 'tilbud' ? `${s} – i dag -10% til kl. 16!` : s
          );

    // Bump usage after successful generation (ignore errors)
    try {
      await bumpUsage(email, feature, new Date().toISOString());
    } catch {}

    return res.status(200).json({ ok: true, suggestions });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
