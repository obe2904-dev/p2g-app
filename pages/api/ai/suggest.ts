import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserEmailFromToken, getUserPlan, LIMITS, getUsage, bumpUsage, nextResetAtISO } from '@/lib/plan';

// NB: Her kalder du din model som før (OpenAI/…)
// Vi stubber med faste forslag for at fokusere på gate’n.
async function runModel(body: any): Promise<string[]> {
  // TODO: erstat med rigtig AI-kald
  if (body.post_body) {
    return [`${body.post_body} (opdateret)`, `${body.post_body} (kortere)`, `${body.post_body} (med hashtags)`];
  }
  return [
    'Idé 1: Ugens kage med latte art ☕🍰',
    'Idé 2: Morgenmadstilbud før kl. 10 🥐',
    'Idé 3: Quiz i aften – spørg din barista ❓'
  ];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const email = await getUserEmailFromToken(req.headers.authorization || null);
  if (!email) return res.status(401).send('Missing/invalid token');

  const plan = await getUserPlan(email);
  const cfg = LIMITS[plan].text_three_new; // gate for “Få 3 nye”
  const used = await getUsage(email, 'text_three_new', cfg.period);

  if (cfg.limit !== null && used >= cfg.limit) {
    return res.status(429).json({
      error: 'quota_exceeded',
      message: plan === 'free'
        ? 'Du har brugt dine 3 forslag for denne uge.'
        : 'Du har brugt dine forslag for i dag.',
      resetAt: nextResetAtISO(cfg.period),
      plan
    });
  }

  // Kald AI (eller dit eksisterende kald) og increment usage
  const suggestions = await runModel(req.body);
  await bumpUsage(email, 'text_three_new', cfg.period);

  return res.status(200).json({ suggestions, plan, period: cfg.period });
}
