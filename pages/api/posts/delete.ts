// pages/api/posts/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Brug service role, fordi serveren (ikke brugeren) sletter i DB
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // 1) Tjek token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user?.email) return res.status(401).send('Invalid token');
    const email = u.user.email;

    // 2) Find ID i body (POST) eller query (DELETE)
    const { id } = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const postId = Number(id);
    if (!postId) return res.status(400).send('Missing id');

    // 3) Tjek at posten findes og tilhører brugeren
    const { data: post, error: pErr } = await admin
      .from('posts_app')
      .select('id, user_email')
      .eq('id', postId)
      .single();

    if (pErr || !post) return res.status(404).send('Post not found');
    if (post.user_email !== email) return res.status(403).send('Forbidden');

    // 4) Slet (hvis du har FK’er, så sæt dem til ON DELETE CASCADE i SQL)
    const { error } = await admin.from('posts_app').delete().eq('id', postId);
    if (error) return res.status(500).send(error.message);

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
