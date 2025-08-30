import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  getUsage,
  bumpUsage,
  nextResetAtISO,
} from '@/lib/plan';

// Hjælpere
type Plan = 'free' | 'basic' | 'pro' | 'premium';
type Period = 'day' | 'week' | 'month';

function planRules(plan: Plan): { period: Period; limit: number | null } {
  // Krav fra dig:
  // - Free: 3/uge
  // - Pro: 3/dag
  // - Premium: ingen grænse (fair use)
  // - Basic: ubegrænset “lette” forslag → ingen grænse
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
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // --- Auth → email
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');

    // --- Plan/forbrug
    const plan = await getUserPlan(email) as Plan;
    const { period, limit } = planRules(plan);

    // Tæl forbrug for feature "text_suggestions" i nuværende periode
    const used = await getUsage(email, 'text_suggestions', period);

    // Gate hvis der er grænse (Free/Pro)
    if (limit !== null && used >= limit) {
      return res.status(429).json({
        ok: false,
        reason: 'limit_reached',
        plan,
        period,
        limit,
        used,
        remaining: 0,
        resetAtISO: nextResetAtISO(period),
        message:
          plan === 'free'
            ? 'Du har brugt ugens 3 gratis tekstforslag.'
            : 'Du har brugt dagens 3 tekstforslag på din plan.',
      });
    }

    // --- Generér/stub forslag
    const { topic, post_body, tone } = (req.body ?? {}) as {
      topic?: string;
      post_body?: string;
      tone?: string;
    };

    // (A) Hvis der skal “forbedres” en eksisterende tekst (rewrite)
    if (post_body && typeof post_body === 'string') {
      // Ultra-simple stub: trim + tilføj 2 hashtags afhængigt af tone
      const base = post_body.trim();
      const tail =
        tone === 'tilbud'
          ? ' #tilbud #café'
          : tone === 'informativ'
          ? ' #vidsteDuvat #café'
          : tone === 'hyggelig'
          ? ' #hygge #café'
          : ' #café #lokalt';
      const improved = (base + ' ' + tail).replace(/\s+/g, ' ').trim();

      // bump usage (selv hvis unlimited, for at have statistik)
      await bumpUsage(email, 'text_suggestions', period);

      return res.status(200).json({
        ok: true,
        suggestions: [improved],
        usage: {
          plan,
          period,
          used: used + 1,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - (used + 1)),
          resetAtISO: nextResetAtISO(period),
        },
      });
    }

    // (B) Ellers: generér 3 nye idé/tekst-forslag
    const baseTopic =
      typeof topic === 'string' && topic.trim()
        ? topic.trim()
        : 'Idéer til opslag for en lokal café';

    // Stub-forslag — kan erstattes af rigtig LLM-kald
    const suggestions = [
      `Friskbagt “Ugens kage” + latte — kig forbi i dag! ${tone === 'tilbud' ? '#tilbud ' : ''}#café #lokalt`,
      `Godmorgen ☕ Vi brygger frisk kaffe fra kl. 7 — hvad drikker du helst? #kaffe #hygge`,
      `Fredagshygge: del et billede fra dit bord og tag os — vi trækker en vinder til en gratis latte! #fredag #post2grow`,
    ].map((s) => s.replace('Idéer til opslag for en lokal café', baseTopic));

    // bump usage én gang pr. “Få 3 nye”
    await bumpUsage(email, 'text_suggestions', period);

    return res.status(200).json({
      ok: true,
      suggestions,
      usage: {
        plan,
        period,
        used: used + 1,
        limit,
        remaining: limit === null ? null : Math.max(0, limit - (used + 1)),
        resetAtISO: nextResetAtISO(period),
      },
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
