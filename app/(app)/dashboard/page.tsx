'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

type Analysis = {
  width: number;
  height: number;
  aspect_label: string;
  brightness: number;
  contrast: number;
  sharpness: number;
  verdict: string;
  suggestions: string[];
} | null;

type TabKey = 'ai' | 'plan' | 'perf';

export default function DashboardPage() {
  // ---------- HERO-KORT ----------
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [countsErr, setCountsErr] = useState<string | null>(null);

  // ---------- TABS ----------
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  // ---------- AI-FORSLAG ----------
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);
  const [sugChanFB, setSugChanFB] = useState(true);
  const [sugChanIG, setSugChanIG] = useState(true);

  // ---------- HURTIGT OPSLAG ----------
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] =
    useState<'neutral' | 'tilbud' | 'informativ' | 'hyggelig'>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [quickImageUrl, setQuickImageUrl] = useState<string>(''); // fra Foto-hjælp

  // ---------- FOTO-HJÆLP ----------
  const [imageUrl, setImageUrl] = useState(''); // upload-resultat
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [photoChanFB, setPhotoChanFB] = useState(true);
  const [photoChanIG, setPhotoChanIG] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);

  // Crop/komposition (P1 – ikke-destruktiv preview)
  const [previewChannel, setPreviewChannel] = useState<'instagram' | 'facebook' | null>(null);
  const [previewAspect, setPreviewAspect] = useState<'1:1' | '4:5' | '1.91:1' | null>(null);
  const [showThirds, setShowThirds] = useState(false);
  const [cropApplied, setCropApplied] = useState<{ channel: string | null; aspect: string | null }>({ channel: null, aspect: null });

  // Simuleret "rengøring via beskæring" små-nudges (ikke destruktivt)
  const [nudge, setNudge] = useState<{ leftPct: number; topPct: number }>({ leftPct: 0, topPct: 0 });

  // Plan til at låse AI-fjernelse (🔒 i Gratis)
  const [plan, setPlan] = useState<'free' | 'basic' | 'pro' | 'premium'>('free');

  // ---------- VIRKSOMHEDSSNAPSHOT ----------
  const [orgName, setOrgName] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [city, setCity] = useState<string>('');

  // Month start
  const startISO = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // Hent tællere
  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setCountsErr('Ikke logget ind.'); return; }

        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        const { count: aiPhotoThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'photo')
          .gte('used_at', startISO);

        setCounts({
          totalPosts: totalPosts ?? 0,
          postsThisMonth: postsThisMonth ?? 0,
          aiTextThisMonth: aiTextThisMonth ?? 0,
          aiPhotoThisMonth: aiPhotoThisMonth ?? 0,
        });
      } catch (e: any) {
        setCountsErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoadingCounts(false);
      }
    })();
  }, [startISO]);

  // Snapshot org + plan
  useEffect(() => {
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, default_org_id, plan_id')
          .maybeSingle();

        if (prof?.plan_id) {
          const p = String(prof.plan_id).toLowerCase();
          if (p === 'premium' || p === 'pro' || p === 'basic' || p === 'free') {
            setPlan(p as any);
          }
        }

        if (prof?.default_org_id) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('name, city, website')
            .eq('id', prof.default_org_id)
            .maybeSingle();
          if (orgRow?.name) setOrgName(orgRow.name);
          if (orgRow?.website) setWebsite(orgRow.website);
          if (orgRow?.city) setCity(orgRow.city);
        }
        if (!orgName) setOrgName('Din virksomhed');

        if (!website) {
          const { data: brand } = await supabase
            .from('brand_sources')
            .select('origin')
            .eq('kind', 'website')
            .limit(1);
          if (brand && brand[0]?.origin) setWebsite(brand[0].origin);
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Første AI-forslag
  useEffect(() => { refreshSuggestions(); }, []);

  async function refreshSuggestions() {
    setSugErr(null);
    setLoadingSug(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Ikke logget ind');

      const chosen: string[] = [];
      if (sugChanFB) chosen.push('Facebook');
      if (sugChanIG) chosen.push('Instagram');
      const channelHint = chosen.length ? ` Kanaler: ${chosen.join(', ')}` : '';

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          topic: 'Idéer til opslag for en lokal virksomhed.' + channelHint,
          tone: 'neutral'
        })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const arr = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [];
      setSuggestions(arr);

      // Lokal tæller (backend logger stadig selv i ai_usage)
      setCounts(c => ({ ...c, aiTextThisMonth: (c.aiTextThisMonth ?? 0) + 1 }));
    } catch (e: any) {
      setSugErr(e.message || 'Kunne ikke hente forslag');
      setSuggestions([]);
    } finally {
      setLoadingSug(false);
    }
  }

  function pickSuggestion(s: string) {
    setBody(s);
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function improveWithAI() {
    try {
      if (!body.trim()) { setStatusMsg('Skriv eller vælg først noget tekst.'); return; }
      setStatusMsg('Forbedrer tekst…');
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatusMsg('Ikke logget ind.'); return; }

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ post_body: body, tone })
      });
      if (!r.ok) { setStatusMsg('AI-fejl: ' + (await r.text())); return; }
      const data = await r.json();
      const first = Array.isArray(data.suggestions) && data.suggestions[0] ? String(data.suggestions[0]) : '';
      if (first) { setBody(first); setStatusMsg('Opdateret med AI ✔'); }
      else setStatusMsg('AI gav ikke et brugbart svar. Prøv igen.');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
  }

  async function saveDraft() {
    setStatusMsg('Gemmer…'); setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatusMsg('Ikke logget ind.'); return; }

      const r = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title, body, image_url: quickImageUrl || imageUrl })
      });
      if (!r.ok) { setStatusMsg('Fejl: ' + (await r.text())); return; }

      setStatusMsg('Gemt som udkast ✔');
      setBody('');
      // behold evt. quickImageUrl/imageUrl
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // -------- Foto upload (Storage) --------
  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) fileInputPick(f);
  }
  async function fileInputPick(file: File) {
    setUploadBusy(true);
    setStatusMsg('Uploader billede…');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setStatusMsg('Ikke logget ind.'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('images')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) { setStatusMsg('Upload-fejl: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
      setImageUrl(pub.publicUrl);
      setQuickImageUrl(pub.publicUrl); // kan bruges i Hurtigt opslag
      setStatusMsg('Billede uploadet ✔');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setUploadBusy(false); }
  }

  // -------- Foto analyse --------
  async function analyzePhoto() {
    if (!imageUrl) { setStatusMsg('Upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setStatusMsg(null);
    try {
      const chosen: string[] = [];
      if (photoChanFB) chosen.push('facebook');
      if (photoChanIG) chosen.push('instagram');

      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, channels: chosen })
      });
      if (!resp.ok) setStatusMsg('Analyse-fejl: ' + (await resp.text()));
      else setAnalysis(await resp.json());
    } catch (e:any) { setStatusMsg('Analyse-fejl: ' + e.message); }
    finally { setAnalyzing(false); }
  }

  // Helpers
  function scrollToQuick() {
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Beregn aspectRatio CSS-værdi
  function cssAspect(aspect: '1:1' | '4:5' | '1.91:1' | null): string | undefined {
    if (!aspect) return undefined;
    if (aspect === '1:1') return '1 / 1';
    if (aspect === '4:5') return '4 / 5';
    // 1.91:1 (bred)
    return '1.91 / 1';
  }

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1 */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loadingCounts ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2 */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loadingCounts ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loadingCounts ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loadingCounts ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Virksomhedsprofil */}
        <div style={{ ...cardStyle, display: 'grid', gap: 6 }}>
          <div style={cardTitle}>Virksomhedsprofil</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{orgName || 'Din virksomhed'}</div>
          <div style={{ fontSize: 13, color: '#555' }}>{city ? `By: ${city}` : 'By: —'}</div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Hjemmeside:{' '}
            {website ? <a href={website} target="_blank" rel="noreferrer">{website}</a> : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Kanaler: Facebook · Instagram
          </div>
          <div style={{ marginTop: 6 }}>
            <Link href="/brand" style={pillLink}>Se profil →</Link>
          </div>
        </div>
      </section>

      {countsErr && <p style={{ color: '#b00' }}>{countsErr}</p>}

      {/* Tabs */}
      <nav style={tabsBar}>
        <button onClick={() => setActiveTab('ai')} style={activeTab === 'ai' ? tabActive : tabBtn}>AI Assistent</button>
        <button onClick={() => setActiveTab('plan')} style={activeTab === 'plan' ? tabActive : tabBtn}>Planlæg & udgiv</button>
        <button onClick={() => setActiveTab('perf')} style={activeTab === 'perf' ? tabActive : tabBtn}>Performance</button>
      </nav>

      {/* Indhold */}
      {activeTab === 'ai' && (
        <section style={{ display: 'grid', gap: 16 }}>
          {/* AI-forslag (3 kort) + “Få 3 nye” + kanaler */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, flex: '1 1 auto', minWidth: 260 }}>
              {[0, 1, 2].map(i => (
                <div key={i}
                  style={{ ...cardStyle, flex: '1 1 0', minWidth: 260, display: 'grid', gridTemplateRows: '1fr auto', gap: 8 }}>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                    {loadingSug ? 'Henter…' : (suggestions[i] || '—')}
                  </div>
                  <div>
                    <button
                      disabled={!suggestions[i]}
                      onClick={() => suggestions[i] && pickSuggestion(suggestions[i]!)}
                      style={{ width: '100%' }}>
                      Brug dette
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gap:6, alignContent:'start' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button onClick={refreshSuggestions} disabled={loadingSug}>
                  {loadingSug ? 'Henter…' : 'Få 3 nye'}
                </button>
                <label style={{ fontSize:12, color:'#555' }}>
                  <input type="checkbox" checked={sugChanFB} onChange={e=>setSugChanFB(e.target.checked)} /> Facebook
                </label>
                <label style={{ fontSize:12, color:'#555' }}>
                  <input type="checkbox" checked={sugChanIG} onChange={e=>setSugChanIG(e.target.checked)} /> Instagram
                </label>
              </div>
              {sugErr && <div style={{ color:'#b00' }}>{sugErr}</div>}
            </div>
          </div>

          {/* Hurtigt opslag */}
          <div id="quick-post" style={cardStyle}>
            <div style={cardTitle}>Hurtigt opslag</div>
            <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
              <label style={labelStyle}>Titel (valgfri)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} />

              <label style={labelStyle}>Tekst</label>
              <textarea rows={6} value={body} onChange={e => setBody(e.target.value)}
                        placeholder="Sæt et AI-forslag ind eller skriv selv…" />

              {/* Mini AI-assistent */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#666' }}>Tone:</span>
                <select value={tone} onChange={e => setTone(e.target.value as any)}>
                  <option value="neutral">Neutral/Venlig</option>
                  <option value="tilbud">Tilbud</option>
                  <option value="informativ">Informativ</option>
                  <option value="hyggelig">Hyggelig</option>
                </select>

                <button type="button" onClick={improveWithAI}>Forbedr med AI</button>
                <button type="button" onClick={saveDraft} disabled={saving}>
                  {saving ? 'Gemmer…' : 'Gem som udkast'}
                </button>
                <Link href="/posts" style={pillLink}>Gå til dine opslag →</Link>
              </div>

              {/* Billede preview der følger opslaget */}
              {(quickImageUrl || imageUrl) && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={quickImageUrl || imageUrl}
                    alt="Valgt billede"
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #eee' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Foto-hjælp — NY 2-kolonne udgave */}
          <div style={cardStyle}>
            <div style={cardTitle}>Foto-hjælp</div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(280px, 1fr) 2fr' }}>
              {/* Venstre kolonne: Kontrolpanel */}
              <div style={{ display: 'grid', gap: 14 }}>
                {/* 1) Beskæring & komposition */}
                <section style={subCard}>
                  <div style={subTitle}>Beskæring & komposition</div>

                  <div style={{ fontSize: 12, color:'#666', marginBottom: 6 }}>Hurtigvalg (1-klik preview):</div>

                  {/* Instagram */}
                  <div style={{ display:'grid', gap:6 }}>
                    <div style={{ fontSize: 12, color:'#444' }}>Instagram (feed)</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <label style={chip}>
                        <input
                          type="radio"
                          name="ratio"
                          checked={previewChannel==='instagram' && previewAspect==='1:1'}
                          onChange={() => { setPreviewChannel('instagram'); setPreviewAspect('1:1'); }}
                        />
                        1:1 (1080×1080)
                      </label>
                      <label style={chip}>
                        <input
                          type="radio"
                          name="ratio"
                          checked={previewChannel==='instagram' && previewAspect==='4:5'}
                          onChange={() => { setPreviewChannel('instagram'); setPreviewAspect('4:5'); }}
                        />
                        4:5 (1080×1350)
                      </label>
                    </div>
                  </div>

                  {/* Facebook */}
                  <div style={{ display:'grid', gap:6, marginTop: 8 }}>
                    <div style={{ fontSize: 12, color:'#444' }}>Facebook (feed)</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <label style={chip}>
                        <input
                          type="radio"
                          name="ratio"
                          checked={previewChannel==='facebook' && previewAspect==='4:5'}
                          onChange={() => { setPreviewChannel('facebook'); setPreviewAspect('4:5'); }}
                        />
                        4:5 (1080×1350)
                      </label>
                      <label style={chip}>
                        <input
                          type="radio"
                          name="ratio"
                          checked={previewChannel==='facebook' && previewAspect==='1.91:1'}
                          onChange={() => { setPreviewChannel('facebook'); setPreviewAspect('1.91:1'); }}
                        />
                        1.91:1 (1200×630)
                      </label>
                    </div>
                  </div>

                  {/* Tredjedels-gitter + knapper */}
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginTop: 10 }}>
                    <label style={{ fontSize:12, color:'#555' }}>
                      <input type="checkbox" checked={showThirds} onChange={e=>setShowThirds(e.target.checked)} /> Vis tredjedels-gitter
                    </label>

                    <button type="button" onClick={() => setStatusMsg('Preview opdateret ✔')}>
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCropApplied({ channel: previewChannel, aspect: previewAspect }); setStatusMsg('Beskæring anvendt (ikke permanent) ✔'); }}
                      disabled={!previewAspect}
                    >
                      Anvend
                    </button>
                  </div>

                  <div style={{ fontSize:12, color:'#666', marginTop:6 }}>
                    Tip: Hold fokus på hovedmotiv – undgå for meget luft.
                  </div>
                </section>

                {/* 2) Rengøring */}
                <section style={subCard}>
                  <div style={subTitle}>Rengøring</div>
                  <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>
                    Skjul distraktion via beskæring (aktiv i alle planer):
                  </div>
                  <div style={{ display:'grid', gap:6 }}>
                    <button type="button" onClick={() => { setNudge({ leftPct: 3, topPct: 0 }); setStatusMsg('Preview: beskær 3% i venstre side ✔'); }}>
                      Beskær 3% i venstre side (fjern hjørne-distraktion)
                    </button>
                    <button type="button" onClick={() => { setNudge({ leftPct: 0, topPct: 2 }); setStatusMsg('Preview: beskær 2% i toppen ✔'); }}>
                      Beskær 2% i toppen (få motiv i rette højde)
                    </button>
                  </div>

                  <div style={{ fontSize:12, color:'#666', marginTop:10 }}>
                    AI-fjernelse (Pro/Premium – senere):
                  </div>
                  <div style={{ display:'grid', gap:6, marginTop:6 }}>
                    <button type="button" disabled={plan==='free' || plan==='basic'} title={plan==='free'||plan==='basic' ? 'Opgradér for at bruge' : ''}>
                      {plan==='free'||plan==='basic' ? '🔒 ' : ''}Fjern skeen til højre
                    </button>
                    <button type="button" disabled={plan==='free' || plan==='basic'} title={plan==='free'||plan==='basic' ? 'Opgradér for at bruge' : ''}>
                      {plan==='free'||plan==='basic' ? '🔒 ' : ''}Reducer synligheden af vandkaraflen
                    </button>
                  </div>
                </section>

                {/* 3) Farver & lys */}
                <section style={subCard}>
                  <div style={subTitle}>Farver & lys</div>
                  <ul style={{ margin:'6px 0 0 18px', fontSize:14 }}>
                    <li>Giv billedet mere varme (café-stemning)</li>
                    <li>Lidt mere kontrast/mætning, så motivet “popper”</li>
                    <li>Lidt ekstra lys på selve desserten (hero shot)</li>
                  </ul>
                  <div style={{ fontSize:12, color:'#666', marginTop:6 }}>
                    (P2: Hurtig-presets med preview + “Gem som kopi”)
                  </div>
                </section>
              </div>

              {/* Højre kolonne: Upload + preview + kanaler */}
              <div style={{ display:'grid', gap:12 }}>
                {/* Upload-zone */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) fileInputPick(f); }}
                  style={{
                    border: '2px dashed #ddd',
                    borderRadius: 12,
                    padding: 20,
                    minHeight: 140,
                    display: 'grid',
                    placeItems: 'center',
                    maxWidth: 720
                  }}
                >
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 8 }}>Upload et billede</div>
                    <div style={{ color:'#666', marginBottom: 10 }}>
                      Få AI-feedback på lys, format og komposition
                    </div>
                    <label
                      style={{
                        display:'inline-block', padding:'10px 14px', border:'1px solid #111',
                        borderRadius:8, cursor:'pointer', background:'#111', color:'#fff'
                      }}
                    >
                      {uploadBusy ? 'Uploader…' : 'Vælg fil'}
                      <input type="file" accept="image/*" onChange={onFileInput} style={{ display:'none' }} />
                    </label>
                  </div>
                </div>

                {/* Kanaler + actions */}
                <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                  <label style={{ fontSize:12, color:'#555' }}>
                    <input type="checkbox" checked={photoChanFB} onChange={e=>setPhotoChanFB(e.target.checked)} /> Facebook
                  </label>
                  <label style={{ fontSize:12, color:'#555' }}>
                    <input type="checkbox" checked={photoChanIG} onChange={e=>setPhotoChanIG(e.target.checked)} /> Instagram
                  </label>

                  <button type="button" onClick={analyzePhoto} disabled={!imageUrl || analyzing}>
                    {analyzing ? 'Analyserer…' : 'Analyser billede'}
                  </button>

                  {imageUrl && (
                    <button type="button" onClick={() => { setQuickImageUrl(imageUrl); scrollToQuick(); }}>
                      Brug i opslag
                    </button>
                  )}
                </div>

                {/* Preview m. aspect + thirds + nudge */}
                {imageUrl && (
                  <div style={{
                    position:'relative',
                    border:'1px solid #eee',
                    borderRadius: 8,
                    overflow:'hidden',
                    // CSS aspect ratio på container:
                    aspectRatio: cssAspect(previewAspect),
                    // Hvis ingen valgt ratio → vis billedet i fri højde
                    minHeight: previewAspect ? undefined : 240
                  }}>
                    {/* Billede */}
                    <img
                      src={imageUrl}
                      alt="Upload"
                      style={{
                        position:'absolute',
                        inset:0,
                        width:'100%',
                        height:'100%',
                        objectFit:'cover',
                        // simuler "nudge" ved at flytte billedets origin (ikke ægte crop – kun preview)
                        transform: `translate(${-nudge.leftPct}%, ${-nudge.topPct}%)`
                      }}
                    />
                    {/* Tredjedels-gitter */}
                    {showThirds && (
                      <>
                        {/* Lodrette linjer */}
                        <div style={gridLineV(33.333)} />
                        <div style={gridLineV(66.666)} />
                        {/* Vandrette linjer */}
                        <div style={gridLineH(33.333)} />
                        <div style={gridLineH(66.666)} />
                      </>
                    )}

                    {/* Badge m. valgt ratio */}
                    {(previewChannel || previewAspect) && (
                      <div style={{
                        position:'absolute', right:8, top:8,
                        fontSize:12, background:'rgba(0,0,0,0.65)', color:'#fff',
                        padding:'2px 8px', borderRadius: 999
                      }}>
                        {previewChannel ? previewChannel : ''}{previewChannel && previewAspect ? ' · ' : ''}{previewAspect || ''}
                      </div>
                    )}
                  </div>
                )}

                {/* Analyse-feedback (hvis kaldt) */}
                {analysis && (
                  <section style={{ marginTop: 8, padding: 10, border: '1px solid #eee', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Foto-feedback</div>
                    <p><strong>Størrelse:</strong> {analysis.width}×{analysis.height} ({analysis.aspect_label})</p>
                    <p>
                      <strong>Lys (0-255):</strong> {analysis.brightness} — <strong>Kontrast:</strong> {analysis.contrast} — <strong>Skarphed:</strong> {analysis.sharpness}
                    </p>
                    <p><strong>Vurdering:</strong> {analysis.verdict}</p>
                    <ul>
                      {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </div>

          {statusMsg && (
            <p style={{ color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>
              {statusMsg}
            </p>
          )}
        </section>
      )}

      {activeTab === 'plan' && (
        <section style={{ ...cardStyle, minHeight: 180 }}>
          (Planlæg & udgiv) – Kommer snart. Her viser vi kalender/planlægning.
        </section>
      )}

      {activeTab === 'perf' && (
        <section style={{ ...cardStyle, minHeight: 180 }}>
          (Performance) – Kommer snart. Her viser vi topopslag / tider / kanaler.
        </section>
      )}
    </div>
  );
}

/* ---------- STYLES ---------- */

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const subCard: React.CSSProperties = {
  border: '1px solid #f0f0f0',
  borderRadius: 10,
  padding: 12,
  background: '#fafafa'
};

const subTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#444',
  fontWeight: 600,
  marginBottom: 6,
};

const cardTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
};

const bigNumber: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.1,
  marginBottom: 6,
};

const subText: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
};

const pillLink: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  border: '1px solid #ddd',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#fafafa',
  textDecoration: 'none',
  color: 'inherit'
};

const tabsBar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  borderBottom: '1px solid #eee',
  paddingBottom: 6,
};

const tabBtn: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #eee',
  background: '#fff',
  borderRadius: 999,
  cursor: 'pointer',
};

const tabActive: React.CSSProperties = {
  ...tabBtn,
  background: '#111',
  color: '#fff',
  borderColor: '#111',
};

const chip: React.CSSProperties = {
  display:'inline-flex',
  gap:6,
  alignItems:'center',
  border: '1px solid #ddd',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

function gridLineV(percent: number): React.CSSProperties {
  return {
    position:'absolute', top:0, bottom:0,
    left: `${percent}%`,
    width: 1, background:'rgba(255,255,255,0.55)'
  };
}
function gridLineH(percent: number): React.CSSProperties {
  return {
    position:'absolute', left:0, right:0,
    top: `${percent}%`,
    height: 1, background:'rgba(255,255,255,0.55)'
  };
}
