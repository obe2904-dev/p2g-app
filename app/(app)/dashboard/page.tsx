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
type Aspect = 'orig' | '1:1' | '4:5' | '1.91:1';

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
  const [uploadBusy, setUploadBusy] = useState(false);

  // Analyse
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [photoChanFB, setPhotoChanFB] = useState(true);
  const [photoChanIG, setPhotoChanIG] = useState(true);

  // Crop/komposition (preview, P1)
  const [cropAspect, setCropAspect] = useState<Aspect>('orig');
  const [posX, setPosX] = useState(50); // 0..100 (object-position X)
  const [posY, setPosY] = useState(50); // 0..100 (object-position Y)
  const [showGrid, setShowGrid] = useState(false);
  const [appliedCrop, setAppliedCrop] = useState<{ aspect: Aspect; posX: number; posY: number } | null>(null);

  // Farver & lys – noter (tekstsuggestions "nu")
  const [colorNotes, setColorNotes] = useState<string[]>([]);

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

  // Snapshot org
  useEffect(() => {
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, default_org_id')
          .maybeSingle();

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
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // -------- Foto upload (Storage) --------
  async function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
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
      setQuickImageUrl(pub.publicUrl);
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

  // -------- Crop helpers (preview P1) --------
  function setAspect(a: Aspect) { setCropAspect(a); }
  function clamp(n:number, min=0, max=100) { return Math.max(min, Math.min(max, n)); }
  function nudge(dir:'left'|'right'|'up'|'down', pct=3) {
    if (dir === 'left') setPosX(x => clamp(x - pct));
    if (dir === 'right') setPosX(x => clamp(x + pct));
    if (dir === 'up') setPosY(y => clamp(y - pct));
    if (dir === 'down') setPosY(y => clamp(y + pct));
  }
  function thirds() { setShowGrid(s => !s); }
  function moveToThird() {
    // enkel “move subject”: skift mellem ~33% og ~66% vandret
    setPosX(x => (x < 50 ? 66 : 33));
  }
  function previewScroll() {
    const el = document.getElementById('photo-preview');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function applyCrop() {
    setAppliedCrop({ aspect: cropAspect, posX, posY });
    // (P2) Gem som kopi i Storage – kommer senere
  }
  function addColorNote(s: string) {
    setColorNotes(list => (list.includes(s) ? list : [...list, s]));
  }
  function clearColorNotes() { setColorNotes([]); }

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  // ---------- UI ----------
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

          {/* Hurtigt opslag (UFORTÆNKT) */}
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

          {/* Foto-hjælp (upload + VENSTRE: crop/rengøring/farver · HØJRE: preview/kanaler/analyse) */}
          <div style={cardStyle}>
            <div style={cardTitle}>Foto-hjælp</div>

            {/* Upload-zone (øverst) */}
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
                maxWidth: 720,
                marginBottom: 12
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

            {/* To kolonner */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {/* VENSTRE: Beskæring & komposition · Rengøring · Farver & lys */}
              <div style={{ flex:'0 1 360px', minWidth: 300, display:'grid', gap:12 }}>
                {/* 1) Beskæring & komposition */}
                <section style={sectionBox}>
                  <div style={sectionTitle}>Beskæring & komposition</div>

                  <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>Hurtigvalg (1-klik preview)</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {/* Instagram */}
                    <span style={badge}>Instagram</span>
                    <button type="button" onClick={() => setAspect('1:1')}
                      style={cropBtn(cropAspect==='1:1')}>1:1 (1080×1080)</button>
                    <button type="button" onClick={() => setAspect('4:5')}
                      style={cropBtn(cropAspect==='4:5')}>4:5 (1080×1350)</button>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                    {/* Facebook */}
                    <span style={badge}>Facebook</span>
                    <button type="button" onClick={() => setAspect('4:5')}
                      style={cropBtn(cropAspect==='4:5')}>4:5 (1080×1350)</button>
                    <button type="button" onClick={() => setAspect('1.91:1')}
                      style={cropBtn(cropAspect==='1.91:1')}>1.91:1 (1200×630)</button>
                  </div>

                  {/* Auto-komposition */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                    <button type="button" onClick={thirds} style={smallBtn}>
                      {showGrid ? 'Skjul tredjedels-gitter' : 'Vis tredjedels-gitter'}
                    </button>
                    <button type="button" onClick={moveToThird} style={smallBtn}>
                      Flyt motiv mod tredjedel
                    </button>
                  </div>

                  {/* Preview/Anvend */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                    <button type="button" onClick={previewScroll}>Preview</button>
                    <button type="button" onClick={applyCrop}>Anvend</button>
                    <button type="button" disabled title="Kommer snart">Gem som kopi (P2)</button>
                  </div>

                  <p style={{ fontSize:12, color:'#666', marginTop:8 }}>
                    Tip: Hold fokus på hovedmotiv – undgå for meget “luft”.
                  </p>
                </section>

                {/* 2) Rengøring */}
                <section style={sectionBox}>
                  <div style={sectionTitle}>Rengøring</div>

                  <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>Skjul distraktion (via beskæring)</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button type="button" onClick={() => nudge('left', 3)} style={smallBtn}>
                      Beskær 3% venstre
                    </button>
                    <button type="button" onClick={() => nudge('right', 3)} style={smallBtn}>
                      Beskær 3% højre
                    </button>
                    <button type="button" onClick={() => nudge('up', 3)} style={smallBtn}>
                      Beskær 3% top
                    </button>
                    <button type="button" onClick={() => nudge('down', 3)} style={smallBtn}>
                      Beskær 3% bund
                    </button>
                  </div>

                  <div style={{ fontSize:12, color:'#666', margin:'10px 0 6px' }}>AI-fjernelse (låst i Gratis)</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button type="button" disabled title="Opgradér for at bruge" style={lockedBtn}>🔒 Fjern skeen til højre</button>
                    <button type="button" disabled title="Opgradér for at bruge" style={lockedBtn}>🔒 Reducér vandkaraflen</button>
                  </div>
                </section>

                {/* 3) Farver & lys */}
                <section style={sectionBox}>
                  <div style={sectionTitle}>Farver & lys</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button type="button" onClick={() => addColorNote('Giv billedet mere varme (café-stemning).')} style={smallBtn}>
                      + Varme (café)
                    </button>
                    <button type="button" onClick={() => addColorNote('Lidt mere kontrast/mætning, så motivet popper.')} style={smallBtn}>
                      + Kontrast/mætning
                    </button>
                    <button type="button" onClick={() => addColorNote('Lidt ekstra lys på desserten (hero shot).')} style={smallBtn}>
                      + Lys på motiv
                    </button>
                    <button type="button" onClick={clearColorNotes} style={smallBtn}>Ryd noter</button>
                  </div>
                  {colorNotes.length > 0 && (
                    <ul style={{ marginTop:8 }}>
                      {colorNotes.map((n,i) => <li key={i} style={{ fontSize:13 }}>{n}</li>)}
                    </ul>
                  )}
                </section>
              </div>

              {/* HØJRE: Preview + kanaler + analyse */}
              <div style={{ flex:'1 1 420px', minWidth: 320 }}>
                {/* Kontroller */}
                <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
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

                {/* Preview */}
                <div id="photo-preview" style={previewWrap(cropAspect)}>
                  {imageUrl ? (
                    <>
                      <img
                        src={imageUrl}
                        alt="Preview"
                        style={{
                          width:'100%', height:'100%',
                          objectFit:'cover',
                          objectPosition: `${posX}% ${posY}%`,
                          display:'block'
                        }}
                      />
                      {showGrid && <ThirdsGrid />}
                      {appliedCrop && (
                        <div style={appliedBadge}>Anvendt</div>
                      )}
                    </>
                  ) : (
                    <div style={{ display:'grid', placeItems:'center', color:'#666', height:'100%' }}>
                      Intet billede endnu
                    </div>
                  )}
                </div>

                {/* Feedback fra analyse */}
                {analysis && (
                  <section style={{ marginTop: 12, padding: 10, border: '1px solid #eee', borderRadius: 8 }}>
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

            {statusMsg && (
              <p style={{ color: statusMsg.startsWith('Fejl') ? '#b00' : '#222', marginTop:8 }}>
                {statusMsg}
              </p>
            )}
          </div>
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

  // helpers
  function scrollToQuick() {
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Preview box med aspectRatio
  function previewWrap(a: Aspect): React.CSSProperties {
    const aspect = a === '1:1' ? '1 / 1' : a === '4:5' ? '4 / 5' : a === '1.91:1' ? '1.91 / 1' : undefined;
    return {
      border:'1px solid #eee',
      borderRadius: 12,
      overflow:'hidden',
      width: '100%',
      maxWidth: 720,
      aspectRatio: aspect, // bruger CSS native; hvis undefined = fri højde (orig)
      minHeight: aspect ? undefined : 240,
      position: 'relative',
      background:'#fafafa'
    };
  }

  function ThirdsGrid() {
    const line: React.CSSProperties = { position:'absolute', background:'rgba(255,255,255,0.8)', pointerEvents:'none' };
    return (
      <>
        <div style={{ ...line, top:0, bottom:0, left:'33.333%', width:1 }} />
        <div style={{ ...line, top:0, bottom:0, left:'66.666%', width:1 }} />
        <div style={{ ...line, left:0, right:0, top:'33.333%', height:1 }} />
        <div style={{ ...line, left:0, right:0, top:'66.666%', height:1 }} />
      </>
    );
  }
}

/* ---------- STYLES ---------- */

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
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

const sectionBox: React.CSSProperties = {
  border:'1px solid #f0f0f0',
  borderRadius: 10,
  padding: 12,
  background:'#fcfcfc'
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color:'#333',
  marginBottom: 6
};

const badge: React.CSSProperties = {
  fontSize: 11, color:'#444', background:'#f3f3f3', border:'1px solid #e5e5e5',
  padding:'2px 8px', borderRadius: 999
};

const smallBtn: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 10px',
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 8,
  cursor: 'pointer'
};

const lockedBtn: React.CSSProperties = {
  ...smallBtn,
  opacity: 0.6,
  cursor: 'not-allowed' as const
};

function cropBtn(active:boolean): React.CSSProperties {
  return {
    ...smallBtn,
    borderColor: active ? '#111' : '#ddd',
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#000'
  };
}

const appliedBadge: React.CSSProperties = {
  position:'absolute',
  right:8, top:8,
  background:'rgba(17,17,17,0.9)',
  color:'#fff',
  padding:'2px 8px',
  fontSize:11,
  borderRadius:999
};
