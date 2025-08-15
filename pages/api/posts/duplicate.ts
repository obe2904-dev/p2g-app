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

    const { source_id, override_title } = req.body || {};
    if (!source_id) return res.status(400).send('Missing source_id');

    const { data: src, error: sErr } = await admin
      .from('posts_app')
      .select('title, body, image_url, user_email')
      .eq('id', source_id)
      .single();
    if (sErr || !src) return res.status(404).send('Source not found');
    if (src.user_email !== email) return res.status(403).send('Forbidden');

    const title = override_title ?? (src.title ? `Kopi af ${src.title}` : 'Kopi af opslag');

    const { data: ins, error } = await admin
      .from('posts_app')
      .insert([{ title, body: src.body, image_url: src.image_url, user_email: email, status: 'draft', updated_at: new Date().toISOString() }])
      .select('id')
      .single();

    if (error) return res.status(500).send(error.message);
    return res.status(200).json({ ok: true, id: ins.id });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
