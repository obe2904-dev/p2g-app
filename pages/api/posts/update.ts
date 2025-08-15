import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return res.status(401).send('Invalid token');
    const email = u.user.email;

    const { id, title, body, image_url, status } = req.body || {};
    if (!id) return res.status(400).send('Missing id');

    // Ejerskab
    const { data: post, error: pErr } = await admin
      .from('posts_app')
      .select('id, user_email')
      .eq('id', id)
      .single();
    if (pErr || !post) return res.status(404).send('Post not found');
    if (post.user_email !== email) return res.status(403).send('Forbidden');

    const { error } = await admin
      .from('posts_app')
      .update({
        title: title ?? null,
        body: body ?? null,
        image_url: image_url ?? null,
        status: status ?? 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return res.status(500).send(error.message);

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
