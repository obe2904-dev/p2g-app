// app/api/brand/scrape/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Forventet body:
 * {
 *   "website": "https://din-cafe.dk/",
 *   "consent": true,
 *   "consent_version": "v0.1",
 *   "summary_text": "Kort opsummering ...",
 *   "keywords": ["kaffe","surdej","brunch"],
 *   "hero_image_url": "https://...",
 *   "previews": [ { "url": "...", "title": "...", "snippet": "..." }, ... ]  // valgfri
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ ok:false, error:'Missing token' }, { status: 401 });

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return NextResponse.json({ ok:false, error:'Invalid token' }, { status: 401 });
    const userId = u.user.id;

    // Find brugerens org
    const { data: prof, error: pErr } = await admin
      .from('profiles')
      .select('default_org_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (pErr) return NextResponse.json({ ok:false, error:pErr.message }, { status: 500 });
    const orgId = prof?.default_org_id;
    if (!orgId) return NextResponse.json({ ok:false, error:'Onboarding incomplete (no organization).' }, { status: 409 });

    // --- Body ---
    const body = await req.json();
    const website: string = (body?.website || '').trim();
    const consent: boolean = !!body?.consent;
    const consent_version: string = body?.consent_version || 'v0.1';
    const summary_text: string = body?.summary_text || '';
    const keywords: string[] = Array.isArray(body?.keywords) ? body.keywords : [];
    const hero_image_url: string | null = body?.hero_image_url || null;
    const previews: Array<{url:string; title?:string|null; snippet?:string|null}> = Array.isArray(body?.previews) ? body.previews : [];

    // Valider website
    let source_domain: string | null = null;
    try {
      const u = new URL(website);
      if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
      source_domain = u.hostname.replace(/^www\./,'');
    } catch {
      return NextResponse.json({ ok:false, error:'Invalid website URL' }, { status: 400 });
    }

    // --- Gem i brand_profiles (upsert) ---
    const source_urls = previews.map(p => p.url);
    const { error: upErr } = await admin
      .from('brand_profiles')
      .upsert({
        org_id: orgId,
        summary_text,
        keywords,
        hero_image_url,
        source_domain,
        source_urls,
        language: 'da',
        consent_at: consent ? new Date().toISOString() : null,
        consent_version: consent ? consent_version : null,
        source_note: consent ? `Godkendt af bruger via UI` : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id' });

    if (upErr) return NextResponse.json({ ok:false, error: upErr.message }, { status: 500 });

    // --- (Valgfri) Gem i brand_sources (små uddrag fra preview) ---
    if (previews.length) {
      // Sæt approved=true på de indsendte kilder
      const rows = previews.slice(0, 8).map(p => ({
        org_id: orgId,
        url: p.url,
        title: p.title || null,
        snippet: (p.snippet || '')?.slice(0, 800) || null,
        approved: true,
        fetched_at: new Date().toISOString()
      }));
      // upsert pr. (org_id,url)
      const { error: srcErr } = await admin
        .from('brand_sources')
        .upsert(rows, { onConflict: 'org_id,url' });
      if (srcErr) {
        // ikke fatal—vi gemte allerede brand_profiles
        console.warn('brand_sources upsert error:', srcErr.message);
      }
    }

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  // venlig besked hvis man rammer via browser
  return NextResponse.json({ ok:false, error:'Use POST' }, { status: 405 });
}
