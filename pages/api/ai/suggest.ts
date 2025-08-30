import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  bumpUsage,
  nextResetAtISO,
} from '@/lib/plan';

// NB: Denne route må kun kaldes med Bearer-token fra Supabase sessionen.
// Vi stubber stadig AI-output (du kan senere erstatte "suggestions" med rigtige AI-kald).

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // --- Parse Authorization header -> token (REN streng) ---
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).send('Missing/invalid token');

  // --- Slå bruger op via token ---
  const email = await getUserEmailFromToken(token);
  if (!email) return res.status(401).send('Invalid token');

  // --- Plan & usage gate ---
  const plan = await getUserPlan(email);
  const usage = await getUsage(email, 'text_suggestions'); // "feature"-navn matcher det du bruger i LIMITS
  const limits = LIMITS[plan];

  // Eksempler på limits:
  // Free: 3 pr. uge, Pro: 3 pr. dag, Premium: fair use (ubrugelig begrænsning).
  // Vi antager at LIMITS indeholder { text_suggestions_per_period: number | 'unlimited', period: 'weekly' | 'daily' | ... }

  // Bloker hvis nået (undtagen 'unlimited')
  const cap = limits.text_suggestions_per_period;
  if (cap !== 'unlimited' && usage.count >= cap) {
    return res.status(429).json({
      error: 'limit_reached',
      plan,
      used: usage.count,
      limit: cap,
      resetAt: nextResetAtISO(limits.period),
      message:
        plan === 'free'
          ? 'Gratis-grænsen er nået. Opgrader for flere daglige forslag.'
          : 'Grænsen for i dag er nået. Prøv igen efter reset.',
    });
  }

  // --- (Stub) generér/returnér 3 forslag ---
  const { topic, tone, post_body } = req.body || {};
  // Her kan du indsætte dit rigtige AI-kald. Vi stubber med simple forslag:
  const suggestions: string[] = post_body
    ? [
        `Forbedret: ${post_body} (tone: ${tone || 'neutral'})`,
        `Variant 2 af din tekst (tone: ${tone || 'neutral'})`,
        `Variant 3 af din tekst (tone: ${tone || 'neutral'})`,
      ]
    : [
        `Idé 1 til caféopslag – ${topic || 'lokal virksomhed'} – med hashtags`,
        `Idé 2 til caféopslag – ${topic || 'lokal virksomhed'} – med spørgsmål i slutningen`,
        `Idé 3 til caféopslag – ${topic || 'lokal virksomhed'} – kort & skarp`,
      ];

  // --- Registrér forbrug ---
  await bumpUsage(email, 'text_suggestions', limits.period);

  return res.status(200).json({ suggestions, plan, used: usage.count + 1 });
}
