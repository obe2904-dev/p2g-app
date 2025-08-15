// pages/api/ai/suggest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Lille helper: lav prompt og sørg for dansk + JSON-output
function buildPrompt(input: { topic?: string; tone?: string; baseBody?: string }) {
  const { topic, tone, baseBody } = input;
  return `
Du er en dansk SoMe-copywriter for caféer. Skriv præcise, korte forslag til et opslag (max ~220 tegn), 1–2 relevante emojis og 0–3 korte hashtags.
Tone: ${tone || 'neutral/venlig'}. Skriv på dansk.

Grundlag (kan være tomt):
${baseBody || '(intet indhold)'}

Emne/kontekst (kan være tomt):
${topic || '(intet yderligere)'}

Svar KUN som gyldig JSON:
{"suggestions": ["forslag 1", "forslag 2", "forslag 3"]}
  `.trim();
}

// Fallback hvis ingen OPENAI_API_KEY er sat
function simpleSuggestions(base: string, topic?: string, tone?: string): string[] {
  const baseOr = base?.trim() ? base.trim() : (topic?.trim() || 'Dagens anbefaling');
  const tag = '#café';
  return [
    `${baseOr} – kig forbi i dag ☕️✨ ${tag}`,
    `${baseOr}. Vi glæder os til at se dig! 😊 ${tag}`,
    `${baseOr} – del gerne med en ven 💬 ${tag}`
  ];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    // Auth
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Login påkrævet');
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user?.email) return res.status(401).send('Ugyldig session');

    const email = u.user.email!;
    const userId = u.user.id!;

    // Input
    const { topic, tone, post_body, post_id } = req.body || {};
    let baseBody: string = post_body || '';

    // Hent tekst fra eksisterende opslag hvis post_id er angivet
    if (!baseBody && post_id) {
      const { data: p, error: pErr } = await admin
        .from('posts_app')
        .select('body, user_email')
        .eq('id', post_id)
        .single();
      if (pErr || !p) return res.status(404).send('Post not found');
      if (p.user_email !== email) return res.status(403).send('Forbidden');
      baseBody = p.body || '';
    }

    // Plan/kvote
    const { data: prof } = await admin.from('profiles').select('plan_id').eq('user_id', userId).single();
    const plan = prof?.plan_id || 'basic';
    const { data: limRow } = await admin
      .from('plan_features')
      .select('limit_value')
      .eq('plan_id', plan)
      .eq('feature_key', 'ai_text_monthly_limit')
      .maybeSingle();
    const limit = limRow?.limit_value as number | null | undefined; // null = ubegrænset

    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const { count } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email)
      .eq('kind', 'text')
      .gte('used_at', start.toISOString());

    if (limit !== null && (count ?? 0) >= limit) {
      return res.status(402).send('Din AI-tekst-kvote for denne måned er opbrugt.');
    }

    // Generér forslag
    const prompt = buildPrompt({ topic, tone, baseBody });
    let suggestions: string[] = [];

    if (OPENAI_API_KEY) {
      // Brug OpenAI Chat Completions (stabilt og simpelt at parse)  [oai_citation:1‡OpenAI Platform](https://platform.openai.com/docs/api-reference/chat?utm_source=chatgpt.com)
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Du er en hjælpsom dansk SoMe-copywriter for caféer.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!r.ok) {
        const t = await r.text();
        return res.status(500).send('LLM error: ' + t);
      }
      const data = await r.json();
      const content: string = data.choices?.[0]?.message?.content || '';

      // Prøv at parse JSON fra svaret
      try {
        const json = JSON.parse(content);
        if (Array.isArray(json.suggestions)) suggestions = json.suggestions.slice(0, 3).map((s: any) => String(s));
      } catch {
        // fallback: split på linjer
        suggestions = content
          .split('\n')
          .map(s => s.replace(/^[\d\-\*\)]+\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 3);
      }
    } else {
      suggestions = simpleSuggestions(baseBody, topic, tone);
    }

    if (!suggestions.length) suggestions = simpleSuggestions(baseBody, topic, tone);

    // Log forbrug (efter succes)
    await admin.from('ai_usage').insert({ user_email: email, kind: 'text' });

    return res.status(200).json({ suggestions });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
