import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    // Tjek login (Bearer token fra klienten)
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).send('Missing token');

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return res.status(401).send('Invalid token');
    const userId = u.user.id;
    const userEmail = u.user.email || '';

    // Body: påkrævede + valgfrie felter
    const {
      full_name,
      org_name,
      city,
      website,
      address,
      phone,
      accept_tos,
      accept_dpa,
      tos_version = 'v0.1',
      dpa_version = 'v0.1'
    } = req.body || {};

    if (!full_name || !org_name || !city) {
      return res.status(400).send('Mangler full_name / org_name / city');
    }
    if (!accept_tos || !accept_dpa) {
      return res.status(400).send('Samtykke til vilkår og databehandleraftale er påkrævet');
    }

    // Er onboarding allerede gennemført?
    const { data: prof, error: pErr } = await admin
      .from('profiles')
      .select('default_org_id, tos_accept_at, dpa_accept_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (pErr) return res.status(500).send(pErr.message);

    const alreadyDone =
      !!prof?.default_org_id && !!prof?.tos_accept_at && !!prof?.dpa_accept_at;

    let orgId = prof?.default_org_id as number | null;

    if (!alreadyDone || !orgId) {
      // 1) Opret organization
      const { data: orgRow, error: orgErr } = await admin
        .from('organizations')
        .insert({
          name: org_name,
          city,
          website: website || null,
          address: address || null,
          phone: phone || null,
          created_by: userId,
          created_by_email: userEmail
        })
        .select('id')
        .single();

      if (orgErr) return res.status(500).send(orgErr.message);
      orgId = orgRow.id as number;

      // 2) Medlemskab (owner)
      const { error: memErr } = await admin
        .from('organization_members')
        .upsert({
          org_id: orgId,
          user_id: userId,
          user_email: userEmail,
          role: 'owner'
        }, { onConflict: 'org_id,user_id' });

      if (memErr) return res.status(500).send(memErr.message);
    }

    // Metadata til samtykke-log
    const consent_ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || (req.socket?.remoteAddress ?? null);
    const consent_user_agent = req.headers['user-agent'] || null;

    // 3) Opdater profil (navn, telefon, org + consent)
    const { error: updErr } = await admin
      .from('profiles')
      .update({
        full_name,
        phone: phone || null,
        default_org_id: orgId,
        tos_accept_version: tos_version,
        tos_accept_at: new Date().toISOString(),
        dpa_accept_version: dpa_version,
        dpa_accept_at: new Date().toISOString(),
        consent_ip,
        consent_user_agent
      })
      .eq('user_id', userId);

    if (updErr) return res.status(500).send(updErr.message);

    return res.status(200).json({ ok: true, org_id: orgId, alreadyCompleted: !!alreadyDone });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
