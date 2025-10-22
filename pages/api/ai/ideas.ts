// pages/api/ai/ideas.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const PRESETS: Record<string, string[]> = {
  Hurtigt: [
    'Dagens kage og en friskbrygget kaffe – kig forbi ☕️🍰',
    'Husk vores morgenkombo: croissant + kaffe til en skarp pris 🥐',
    'Tag en ven med til eftermiddagshygge – vi har pladsen klar ✨',
  ],
  Tilbud: [
    '2 for 1 på iskaffe mellem 14–16 i dag 🧊☕️',
    'Formiddagsdeal: Valgfri toast + filterkaffe til 59,- 🧀',
    'Efter kl. 17: dagens salat + sodavand til 89,- 🥗',
  ],
  Begivenhed: [
    'Live musik fredag kl. 19 – kom i god tid 🎶',
    'Quiz-aften onsdag! Saml holdet og vind lækker præmie 🧠',
    'Brætspils-søndag fra kl. 13 – familiehygge velkommen 🎲',
  ],
  Personlig: [
    'Mød vores barista, Ali – hvad vil du gerne have, han laver til dig i dag? ☕️',
    'Bag om disken: vi tester nye bønner – vil du smage? 🌱',
    'Team-love: tak fordi I gør hverdagen hyggelig for os 💛',
  ],
  Brugerindhold: [
    'Del dit yndlingshjørne i caféen og tag os – vi repost’er 📸',
    'Har du en café-tradition? Fortæl os om den i kommentarerne ✍️',
    'Ugens gæstebillede: tag os i dit opslag for at være med ⭐️',
  ],
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { n = '6', category = 'Hurtigt' } = req.query;
  const list = PRESETS[String(category)] || PRESETS.Hurtigt;
  // simple shuffle
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  const take = Math.max(1, Math.min(12, Number(n) || 6));
  res.status(200).json({ ideas: shuffled.slice(0, take) });
}
