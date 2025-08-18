// pages/api/stats/overview.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    // Auth: forventer Bearer <supabase access_token> fra klienten
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user?.email) return res.status(401).send('Invalid token');

    const email = u.user.email!;

    // Tidsgrænse for "denne måned"
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    // Kun status='published'
    const { count: total_published } = await admin
      .from('posts_app')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email)
      .eq('status', 'published');

    const { count: month_published } = await admin
      .from('posts_app')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email)
      .eq('status', 'published')
      .gte('created_at', start.toISOString());

    return res.status(200).json({
      posts: {
        total_published: typeof total_published === 'number' ? total_published : 0,
        month_published: typeof month_published === 'number' ? month_published : 0,
      },
    });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
