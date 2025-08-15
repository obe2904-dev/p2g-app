// app/api/brand/scrape/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

type PreviewItem = { url: string; title: string | null; snippet: string | null; ogImage?: string | null };

const STOP_DA = new Set([
  'og','i','på','at','af','for','fra','til','der','som','med','en','et','de','den','det','du','vi','jeg','jer','han','hun',
  'er','var','bliver','blev','har','havde','have','kan','skal','vil','må','ikke','men','eller','så','bare','også',
  'her','der','hvor','hvornår','hvorfor','hvordan','meget','mere','mest','lidt','alle','alt','alle','noget','nogle',
  'om','ind','ud','over','under','efter','før','mellem','uden','samme','sådan','således','din','dit','dine','min','mit','mine',
  'vores','jeres',' deres','man','folk','lige','mere','mindst','mest','helt','rigtig','god','gode','flere','få',
  'cafe','café','menu','kort','om','kontakt','velkommen'
]);

function normUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u;
  } catch { return null; }
}
function withinSameDomain(u: URL, baseHost: string) {
  return u.hostname.replace(/^www\./,'') === baseHost.replace(/^www\./,'');
}
function textify($: cheerio.CheerioAPI) {
  ['script','style','noscript','iframe','svg','nav','footer','header'].forEach(sel => $(sel).remove());
  const t = $('body').text().replace(/\s+/g,' ').trim();
  return t.slice(0, 10000);
}
function titleOf($: cheerio.CheerioAPI) {
  const ogt = $('meta[property="og:title"]').attr('content') || null;
  const t = $('title').first().text()?.trim() || null;
  return ogt || t;
}
function ogImageOf($: cheerio.CheerioAPI) {
  const og = $('meta[property="og:image"]').attr('content');
  if (og) return og;
  const img = $('img[src]').first().attr('src');
  return img || null;
}
function snippetOf(t: string) {
  if (!t) return null;
  const m = t.match(/[^.?!]{40,220}[.?!]/g);
  const pick = m?.find(s => /café|kaffe|brunch|menu|kage|sandwich|morgenmad|frokost/i.test(s)) || t.slice(0, 260);
  return pick.trim();
}
function topKeywords(texts: string[], max = 10) {
  const freq = new Map<string, number>();
  for (const t of texts) {
    const words = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_DA.has(w) && !/^\d+$/.test(w));
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const boost = new Set(['kaffe','espresso','latte','cappuccino','te','croissant','kage','brød','surdej','brunch','morgenmad','frokost','menu','sæson','lokal','økologisk','vegansk','glutenfri','to-go']);
  const items = [...freq.entries()].map(([w,c]) => [w, c + (boost.has(w) ? 2 : 0)] as [string, number]);
  items.sort((a,b) => b[1] - a[1]);
  const picked: string[] = [];
  for (const [w] of items) {
    if (picked.some(p => p.startsWith(w) || w.startsWith(p))) continue;
    picked.push(w);
    if (picked.length >= max) break;
  }
  return picked;
}
async function fetchHtml(u: URL, timeoutMs = 10000): Promise<string | null> {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(u.toString(), {
      signal: ac.signal,
      headers: {
        'user-agent': 'Post2GrowBot/0.1 (+https://cafe.post2grow.dk)',
        'accept': 'text/html,application/xhtml+xml'
      } as any
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return null;
    const html = await resp.text();
    return html;
  } catch { return null; }
  finally { clearTimeout(tm); }
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ ok:false, error:'Missing token' }, { status: 401 });

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return NextResponse.json({ ok:false, error:'Invalid token' }, { status: 401 });

    // Org
    const { data: prof, error: pErr } = await admin
      .from('profiles')
      .select('default_org_id')
      .eq('user_id', u.user.id)
      .maybeSingle();
    if (pErr) return NextResponse.json({ ok:false, error:pErr.message }, { status: 500 });
    const orgId = prof?.default_org_id;
    if (!orgId) return NextResponse.json({ ok:false, error:'Onboarding incomplete (no organization).' }, { status: 409 });

    // Input
    const body = await req.json();
    const website = (body?.website || '').trim();
    const baseUrl = normUrl(website);
    if (!baseUrl) return NextResponse.json({ ok:false, error:'Invalid website URL' }, { status: 400 });
    const baseHost = baseUrl.hostname.replace(/^www\./,'');

    // Kandidater
    const candidates = [
      baseUrl.toString(),
      new URL('/om', baseUrl).toString(),
      new URL('/about', baseUrl).toString(),
      new URL('/menu', baseUrl).toString(),
      new URL('/kort', baseUrl).toString(),
      new URL('/kontakt', baseUrl).toString(),
      new URL('/contact', baseUrl).toString(),
    ];
    const seen = new Set<string>();
    const urls: URL[] = [];
    for (const raw of candidates) {
      const u = normUrl(raw);
      if (!u) continue;
      if (!withinSameDomain(u, baseHost)) continue;
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(u);
      if (urls.length >= 6) break;
    }

    // Hent op til 4 sider
    const previews: PreviewItem[] = [];
    let hero: string | null = null;
    const collectedTexts: string[] = [];
    const sourceUrls: string[] = [];

    for (const u2 of urls) {
      if (previews.length >= 4) break;
      const html = await fetchHtml(u2);
      if (!html) continue;

      const $ = cheerio.load(html);
      const title = titleOf($);
      const ogImg = ogImageOf($) || null;
      const txt = textify($);
      const snippet = snippetOf(txt);

      previews.push({ url: u2.toString(), title, snippet, ogImage: ogImg });
      sourceUrls.push(u2.toString());
      collectedTexts.push(txt);
      if (!hero && ogImg) {
        try { hero = new URL(ogImg, u2).toString(); } catch { hero = ogImg; }
      }
    }

    if (previews.length === 0) {
      return NextResponse.json({ ok:false, error:'Could not fetch any HTML pages from the domain.' }, { status: 422 });
    }

    const keywords = topKeywords(collectedTexts, 8);
    const summary_text =
      `Caféprofil baseret på ${previews.length} side${previews.length > 1 ? 'r' : ''} fra ${baseHost}. ` +
      (keywords.length ? `Kerneord: ${keywords.slice(0, 6).join(', ')}.` : '').trim();

    return NextResponse.json({
      ok: true,
      source_domain: baseHost,
      previews,
      proposal: {
        summary_text,
        keywords,
        hero_image_url: hero || null,
        source_urls: sourceUrls,
        language: 'da'
      }
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'Server error' }, { status: 500 });
  }
}

// (Valgfrit: Hvis nogen rammer GET direkte i browseren, svar pænt)
export async function GET() {
  return NextResponse.json({ ok:false, error: 'Use POST' }, { status: 405 });
}
