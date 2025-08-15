import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (server only)
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    // Validate token & get user
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).send('Invalid token');

    const email = userData.user.email;
    const { title, body, image_url } = req.body || {};
    if (!body || typeof body !== 'string') return res.status(400).send('Body (tekst) er påkrævet');

    // Opret række
    const { error } = await admin
      .from('posts_app')
      .insert([{ title, body, image_url: image_url ?? null, user_email: email, status: req.body?.status ?? 'draft', updated_at: new Date().toISOString() }])

    if (error) return res.status(500).send(error.message);

    // (Valgfrit) webhook til Make
    const webhook = process.env.MAKE_WEBHOOK_URL;
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'post_created', title, body, image_url, userEmail: email })
        });
      } catch (e) {
        // ignore errors i MVP
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
