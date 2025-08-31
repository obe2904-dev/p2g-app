import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // Valgfri simpel nøgle, hvis du vil beskytte endpointet mod tilfældige requests
  const requiredKey = process.env.METRICS_INGEST_TOKEN;
  if (requiredKey && req.headers['x-api-key'] !== requiredKey) {
    return res.status(401).send('Unauthorized');
  }

  try {
    // Body eksempel:
    // {
    //   "post_id": 123,
    //   "channel": "facebook",
    //   "metrics": { "impressions": 1200, "likes": 24, "comments": 3, "shares": 1 },
    //   "observed_at": "2025-08-14T08:00:00Z",
    //   "external_id": "1789_123456"  // valgfri
    // }
    const { post_id, channel, metrics, observed_at, external_id } = req.body || {};
    if (!post_id || !channel || typeof metrics !== 'object') {
      return res.status(400).send('Missing post_id/channel/metrics');
    }

    // Hent ejerens e-mail via post_id (bruges til RLS-læsning senere)
    const { data: post, error: postErr } = await admin
      .from('posts_app')
      .select('user_email')
      .eq('id', post_id)
      .single();

    if (postErr || !post) return res.status(404).send('Post not found');

    // (Valgfrit) opdater/indsæt kobling til ekstern kanal
    if (external_id) {
      await admin
        .from('posts_channels')
        .upsert(
          { post_id, channel, external_id, user_email: post.user_email },
          { onConflict: 'post_id,channel' }
        );
    }

    // Omdan metrics-objekt til rækker
    const rows = Object.entries(metrics).map(([metric, value]) => ({
      post_id,
      channel,
      metric,
      value,
      observed_at: observed_at || new Date().toISOString(),
      user_email: post.user_email
    }));

    const { error } = await admin.from('posts_metrics').insert(rows);
    if (error) return res.status(500).send(error.message);

    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
