import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUserEmailFromToken,
  getUserPlan,
  LIMITS,
  getUsage,
  bumpUsage,
  nextResetAtISO,
} from '@/lib/plan';

type SuggestBody =
  | { topic: string; tone?: string }
  | { post_body: string; tone?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';  // altid string
    const email = await getUserEmailFromToken(token);
    if (!email) return res.status(401).send('Missing/invalid token');
    if (!email) return res.status(401).send('Missing/invalid token');

    const plan = await getUserPlan(email);

    // ---- Gate pr. feature ----
    const feature = 'text_suggestions' as const;
    const { limit, period } = LIMITS[plan][feature]; // fx { limit: 3, period: 'day'|'week' } eller { limit: 'unlimited', period: 'day' }

    if (limit !== 'unlimited') {
      const usage = await getUsage(email, feature, period);
      if (usage.used >= limit) {
        return res.status(429).json({
          ok: false,
          reason: 'limit',
          plan,
          feature,
          limit,
          period,
          used: usage.used,
          resetAt: nextResetAtISO(period),
        });
      }
    }

    // ---- Her ville du kalde din rigtige AI-model ----
    const body = (req.body || {}) as SuggestBody;
    // Minimal stub – returnér tre forslag (samme form som før)
    const suggestions = [
      'Idé: Ugens kage – “Saftig gulerodskage med flødeost”. Tekst: Kom forbi i eftermiddag og smag vores friskbagte gulerodskage. #caféhygge #kage #lokalt',
      'Idé: Morgenkaffe. Tekst: Godmorgen! Vi brygger din latte, cappuccino eller filter – hvad vælger du i dag? #kaffetid #latteart',
      'Idé: Fredagsstemning. Tekst: Weekenden er i gang – kig ind til et glas kold lemonade eller iskaffe. #fredag #sommerdrik',
    ];

    // ---- Bump usage (kun hvis vi faktisk leverer forslag) ----
    if (limit !== 'unlimited') {
      await bumpUsage(email, feature, period);
    }

    return res.status(200).json({
      ok: true,
      plan,
      feature,
      period,
      suggestions: suggestions.slice(0, 3),
    });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
