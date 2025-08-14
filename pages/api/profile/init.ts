import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).send('Invalid token');

    const user_id = userData.user.id;
    const email = userData.user.email || null;

    // Læs branch fra cookie header hvis findes (fallback til 'cafe')
    const cookie = req.headers.cookie || '';
    const m = /(?:^|; )industry=([^;]+)/.exec(cookie);
    const industry = (m ? decodeURIComponent(m[1]) : 'cafe') as 'cafe' | 'frisor' | 'fysio';

    // Upsert profil
    const { error } = await admin
      .from('profiles')
      .upsert({ user_id, industry }, { onConflict: 'user_id' });

    if (error) return res.status(500).send(error.message);

    return res.status(200).json({ ok: true, email, industry });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
