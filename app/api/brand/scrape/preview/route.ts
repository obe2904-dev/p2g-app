// app/api/brand/scrape/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// ---- typer (letvægts) ----
type PreviewItem = {
  url: string;
  title: string | null;
  snippet: string | null;
  ogImage?: string | null;
  kind?: 'html' | 'pdf';
  lang?: string | null;
};
type LdRestaurant = {
  '@type'?: string | string[];
  name?: string;
  servesCuisine?: string | string[];
  telephone?: string;
  address?: any;
  menu?: string | string[];
};

// ---- dansk stop-ord + café-boost ----
const STOP_DA = new Set([
  'og','i','på','at','af','for','fra','til','der','som','med','en','et','de','den','det','du','vi','jeg','jer','han','hun',
  'er','var','bliver','blev','har','havde','have','kan','skal','vil','må','ikke','men','eller','så','bare','også',
  'her','der','hvor','hvornår','hvorfor','hvordan','meget','mere','mest','lidt','alle','alt','alle','noget','nogle',
  'om','ind','ud','over','under','efter','før','mellem','uden','samme','sådan','således','din','dit','dine','min','mit','mine',
  'vores','jeres','deres','man','folk','lige','mindst','mest','helt','rigtig','god','gode','flere','få',
  'cafe','café','menu','kort','om','kontakt','velkommen'
]);
const BOOST = new Set([
  'kaffe','espresso','latte','cappuccino','filter','te',
  'croissant','kage','brød','surdej','brunch','morgenmad','frokost','aftensmad','snack','dessert',
  'sæson','lokal','økologisk','vegansk','vegetar','glutenfri','to-go','takeaway','take-away'
]);

// ---- hjælper-funktioner ----
function normUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u;
  } catch { return null; }
}
function sameSite(u: URL, baseHost: string) {
  const h = u.hostname.replace(/^www\./,'');
  const b = baseHost.replace(/^www\./,'');
  return h === b || h.endsWith('.' + b);
}
function absUrl(maybe: string | undefined, base: URL) {
  if (!maybe) return null;
  try { return new URL(maybe, base).toString(); } catch { return null; }
}
function textify($: cheerio.CheerioAPI) {
  ['script','style','noscript','iframe','svg'].forEach(sel => $(sel).remove());
  const t = $('body').text().replace(/\s+/g,' ').trim();
  return t.slice(0, 15000);
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
  const pick = m?.find(s => /café|cafe|kaffe|brunch|menu|kage|sandwich|morgenmad|frokost|take[\s-]?away/i.test(s))
           || t.slice(0, 260);
  return pick.trim();
}
function sha1(s: string) { return createHash('sha1').update(s).digest('hex'); }
function langHints($: cheerio.CheerioAPI, text: string) {
  const langAttr = ($('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '').toLowerCase() || null;
  const ogLocale = ($('meta[property="og:locale"]').attr('content') || '').toLowerCase() || null;
  const daTokens = (text.match(/\b(og|ikke|med|til|fra|der|som|kan|skal|må|vi|jer|dig|din|vores|velkommen)\b/gi) || []).length;
  let score = 0;
  if (langAttr?.startsWith('da')) score += 3;
  if (ogLocale?.startsWith('da')) score += 2;
  score += Math.min(3, Math.floor(daTokens / 10)); // max +3 for token-density
  return { lang: langAttr || null, score };
}
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
function topKeywords(texts: string[], extra: string[] = [], max = 12) {
  const freq = new Map<string, number>();
  const push = (w: string, inc = 1) => freq.set(w, (freq.get(w) || 0) + inc);
  for (const t of texts) {
    const words = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_DA.has(w) && !/^\d+$/.test(w));
    for (const w of words) push(w, BOOST.has(w) ? 2 : 1);
  }
  for (const k of extra) push(k.toLowerCase(), BOOST.has(k.toLowerCase()) ? 3 : 1);
  const items = [...freq.entries()];
  items.sort((a,b) => b[1] - a[1]);
  const picked: string[] = [];
  for (const [w] of items) {
    if (picked.some(p => p.startsWith(w) || w.startsWith(p))) continue;
    picked.push(w);
    if (picked.length >= max) break;
  }
  return picked;
}

async function fetchHtml(u: URL, timeoutMs = 10000): Promise<{ html: string; $: cheerio.CheerioAPI } | null> {
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(u.toString(), {
      signal: ac.signal,
      headers: {
        'user-agent': 'Post2GrowBot/0.2 (+https://cafe.post2grow.dk)',
        'accept': 'text/html,application/xhtml+xml'
      } as any
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    return { html, $ };
  } catch { return null; }
  finally { clearTimeout(tm); }
}

// ---- hovedhandler ----
export async function POST(req: NextRequest) {
  try {
    // Auth
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ ok:false, error:'Missing token' }, { status: 401 });

    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u.user) return NextResponse.json({ ok:false, error:'Invalid token' }, { status: 401 });

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
    const website: string = (body?.website || '').trim();
    const baseUrl = normUrl(website);
    if (!baseUrl) return NextResponse.json({ ok:false, error:'Invalid website URL' }, { status: 400 });
    const baseHost = baseUrl.hostname.replace(/^www\./,'');

    // ============== KANDIDATER ==============
    const candidateSet = new Set<string>();
    const pushCandidate = (abs: string | null) => {
      if (!abs) return;
      const u2 = normUrl(abs);
      if (!u2) return;
      if (!sameSite(u2, baseHost)) return;
      candidateSet.add(u2.toString());
    };

    // 0) Basissider
    [
      baseUrl.toString(),
      new URL('/om', baseUrl).toString(),
      new URL('/about', baseUrl).toString(),
      new URL('/menu', baseUrl).toString(),
      new URL('/menukort', baseUrl).toString(),
      new URL('/kort', baseUrl).toString(),
      new URL('/takeaway', baseUrl).toString(),
      new URL('/take-away', baseUrl).toString(),
      new URL('/bestil', baseUrl).toString(),
      new URL('/kontakt', baseUrl).toString(),
      new URL('/contact', baseUrl).toString(),
    ].forEach(u => pushCandidate(u));

    // 1) Scan forside for menupunkter + PDF
    const home = await fetchHtml(baseUrl);
    let schemaCuisine: string[] = [];
    if (home) {
      const { $, html } = home;

      // schema.org Restaurant/LocalBusiness
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw = $(el).contents().text();
          if (!raw) return;
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const obj of arr) {
            const types = toArray<string>((obj as LdRestaurant)['@type'] as any).map(s => (s || '').toLowerCase());
            if (types.some(t => /restaurant|localbusiness|foodestablishment/.test(t))) {
              const ld = obj as LdRestaurant;
              schemaCuisine.push(...toArray(ld.servesCuisine).map(s => String(s)));
              for (const m of toArray<string>(ld.menu as any)) pushCandidate(absUrl(m, baseUrl));
            }
          }
        } catch {}
      });

      // nav/links → relevante anchors
      const KEYWORDS = /(menu|menukort|take[\s-]?away|bestil|order|food|mad|brunch|frokost|dessert|drikke|drinks)/i;
      $('a[href]').each((_, a) => {
        const href = $(a).attr('href') || '';
        const txt = ($(a).text() || '').trim().toLowerCase();
        if (KEYWORDS.test(href) || KEYWORDS.test(txt)) pushCandidate(absUrl(href, baseUrl));
        // PDF links (menukort.pdf)
        if (/\.pdf(\?|#|$)/i.test(href)) pushCandidate(absUrl(href, baseUrl));
      });
    }

    // Til array og begræns
    const candidates = [...candidateSet].slice(0, 16); // vi prøver bredere nu

    // ============== HENT SIDER (maks 8 HTML + evt. PDF-links) ==============
    const previews: PreviewItem[] = [];
    const collectedTexts: string[] = [];
    const sourceUrls: string[] = [];
    const contentHashes = new Set<string>();
    const pdfLinks: string[] = [];
    let hero: string | null = null;
    let bestLangScore = -1;
    let source_domain = baseHost;

    for (const raw of candidates) {
      const u2 = new URL(raw);
      if (/\.pdf(\?|#|$)/i.test(u2.pathname)) {
        // PDF — vi scraper ikke teksten i MVP, men viser linket i preview
        pdfLinks.push(u2.toString());
        continue;
      }

      if (previews.length >= 8) break;
      const fetched = await fetchHtml(u2);
      if (!fetched) continue;

      const { $, html } = fetched;
      const txt = textify($);
      if (!txt) continue;

      // dedup på indhold
      const h = sha1(txt.slice(0, 5000));
      if (contentHashes.has(h)) continue;
      contentHashes.add(h);

      const title = titleOf($);
      const ogImg = ogImageOf($) || null;
      const snippet = snippetOf(txt);
      const { lang, score } = langHints($, txt);

      // vælg hero fra den bedste (danske) side først
      if (!hero && ogImg) {
        try { hero = new URL(ogImg, u2).toString(); } catch { hero = ogImg; }
        bestLangScore = score;
      } else if (ogImg && score > bestLangScore) {
        try { hero = new URL(ogImg, u2).toString(); } catch { hero = ogImg; }
        bestLangScore = score;
      }

      previews.push({ url: u2.toString(), title, snippet, ogImage: hero, kind:'html', lang });
      sourceUrls.push(u2.toString());
      collectedTexts.push(txt);
    }

    // Tilføj PDF-links som “previews” (uden snippet)
    for (const p of pdfLinks.slice(0, 4)) {
      previews.push({
        url: p,
        title: p.split('/').pop() || p,
        snippet: 'PDF (menukort)',
        kind: 'pdf'
      });
      sourceUrls.push(p);
    }

    if (previews.length === 0) {
      return NextResponse.json({ ok:false, error:'Could not fetch any pages (HTML/PDF) from the domain.' }, { status: 422 });
    }

    // ============== NØGLEORD + OPSUMMERING ==============
    const extraKw = schemaCuisine.map(s => String(s)).filter(Boolean);
    const keywords = topKeywords(collectedTexts, extraKw, 12);
    const daish = bestLangScore >= 2; // heuristik: “dansk nok”

    let summary_text =
      `Caféprofil baseret på ${previews.filter(p => p.kind !== 'pdf').length} side` +
      `${previews.length > 1 ? 'r' : ''} fra ${source_domain}` +
      `${pdfLinks.length ? ` (+ ${pdfLinks.length} PDF-link${pdfLinks.length>1?'s':''})` : ''}. `;
    if (extraKw.length) {
      const uniqCuisine = [...new Set(extraKw.map(s => s.toLowerCase()))].slice(0,3);
      if (uniqCuisine.length) summary_text += `Køkken: ${uniqCuisine.join(', ')}. `;
    }
    if (keywords.length) summary_text += `Kerneord: ${keywords.slice(0, 8).join(', ')}.`;
    if (!daish) summary_text += ` (Bemærk: Vi fandt primært ikke-danske sider – kan justeres i næste trin.)`;

    return NextResponse.json({
      ok: true,
      source_domain,
      previews,
      proposal: {
      summary_text,
      keywords,
      hero_image_url: hero || null,
    // 🔧 FIX HER:
    source_urls: sourceUrls,
    language: daish ? 'da' : 'en'
  }
});
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'Server error' }, { status: 500 });
  }
}

// Pæn fejl ved GET i browser
export async function GET() {
  return NextResponse.json({ ok:false, error: 'Use POST' }, { status: 405 });
}
