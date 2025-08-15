// pages/api/ai/usage/add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// Generic endpoint to record an AI usage event (kind = 'text' | 'photo')
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return res.status(401).send('Invalid token');

    const email = u.user.email || '';
    const { kind, post_id } = (req.body || {}) as { kind?: string; post_id?: number };

    if (!kind || !['text', 'photo'].includes(kind)) {
      return res.status(400).send('Invalid kind');
    }

    const row: Record<string, any> = {
      user_email: email,
      kind,
      used_at: new Date().toISOString(),
    };
    if (post_id) row.post_id = post_id;

    const { error } = await admin.from('ai_usage').insert(row);
    if (error) return res.status(500).send(error.message);

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
