'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Card from './Card';

type Tone = 'neutral' | 'tilbud' | 'informativ' | 'hyggelig';
type Platform = '' | 'facebook' | 'instagram';

type SuggestionMeta = {
  type: string;
  engagement: 'Høj' | 'Mellem';
  bestTime: string;
};

type PhotoAnalysisResult = {
  summary: string;
  overlayTip?: string;
  crop: { id: string; label: string; description?: string; locked?: boolean }[];
  cleanup: { id: string; label: string; locked?: boolean; hint?: string }[];
  color: { id: string; label: string; locked?: boolean }[];
};

export default function TabAiAssistant({ onAiTextUse }: { onAiTextUse?: () => void }) {
  // -------- Platform-valg --------
  const [platform, setPlatform] = useState<Platform>('');

  // -------- AI-forslag --------
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);

  // -------- Hurtigt opslag --------
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<Tone>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // -------- Foto & video --------
  const [photoPreview, setPhotoPreview] = useState<string>('');         // lokalt preview (ObjectURL)
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');       // knyttes til Hurtigt opslag
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());         // valgte forbedringer (id’er)

  // Små “meta-chips” (kun UI)
  const metas: Record<'facebook' | 'instagram', SuggestionMeta[]> = useMemo(() => ({
    facebook: [
      { type: 'Community', engagement: 'Høj',   bestTime: 'kl. 13:00' },
      { type: 'Spørgsmål', engagement: 'Mellem', bestTime: 'kl. 15:00' },
      { type: 'Lærings-tip', engagement: 'Høj',  bestTime: 'kl. 11:00' },
    ],
    instagram: [
      { type: 'Visuel story', engagement: 'Høj',   bestTime: 'kl. 14:00' },
      { type: 'Lifestyle',    engagement: 'Høj',   bestTime: 'kl. 08:00' },
      { type: 'Trending',     engagement: 'Mellem',bestTime: 'kl. 18:00' },
    ],
  }), []);

  // Reset forslag ved platform- eller foto-skift
  useEffect(() => { setSuggestions([]); setSugErr(null); }, [platform]);
  useEffect(() => { setAnalysis(null); setChosen(new Set()); }, [photoPreview, platform]);

  async function refreshSuggestions() {
    if (!platform) { setSugErr('Vælg først Facebook eller Instagram.'); return; }
    setSugErr(null);
    setLoadingSug(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Ikke logget ind');

      const channelHint = ` Kanaler: ${platform === 'facebook' ? 'Facebook' : 'Instagram'}`;

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          topic: 'Idéer til opslag for en lokal virksomhed.' + channelHint,
          tone: 'neutral'
        })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const arr = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [];
      setSuggestions(arr);

      // Lokal tæller-løft (HeroRow kan lytte via prop)
      onAiTextUse?.();
    } catch (e: any) {
      setSugErr(e.message || 'Kunne ikke hente forslag');
      setSuggestions([]);
    } finally {
      setLoadingSug(false);
    }
  }

  function pickSuggestion(s: string) {
    setBody(s);
    scrollToQuick();
  }

  function scrollToQuick() {
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
        body: JSON.stringify({ title, body, image_url: quickImageUrl || '' })
      });
      if (!r.ok) { setStatusMsg('Fejl: ' + (await r.text())); return; }

      setStatusMsg('Gemt som udkast ✔');
      setTitle('');
      setBody('');
      // behold quickImageUrl – det kan være rart at bruge igen
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // Foto (lokal upload/preview)
  function onPickLocalPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f); // lokal, hurtig preview
    setPhotoPreview(url);
  }
  function usePhotoInPost() {
    if (!photoPreview) return;
    setQuickImageUrl(photoPreview);
    scrollToQuick();
  }

  // -------- Foto: “Analyse” (fase 1 — stub) --------
  function analyzePhoto() {
    if (!photoPreview) return;
    if (!platform) { setStatusMsg('Vælg en platform før analyse.'); return; }
    setIsAnalyzing(true);
    setStatusMsg(null);

    // Simuleret analyse – platform-specifikke forslag
    const res = buildMockAnalysis(platform);
    // “latens” følelse
    setTimeout(() => {
      setAnalysis(res);
      setIsAnalyzing(false);
    }, 600);
  }

  function toggleChoice(id: string) {
    setChosen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // UI helpers
  const chip = (text: string) => (
    <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #eee', borderRadius: 999, background:'#fafafa' }}>
      {text}
    </span>
  );

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      {/* Platform-valg */}
      <Card title="Vælg platform">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, maxWidth: 420 }}>
          <button
            type="button"
            onClick={()=>setPlatform('facebook')}
            style={{
              padding:'12px 14px',
              border:'1px solid ' + (platform==='facebook' ? '#111' : '#ddd'),
              background: platform==='facebook' ? '#111' : '#fff',
              color: platform==='facebook' ? '#fff' : '#111',
              borderRadius: 10,
              cursor:'pointer'
            }}
          >
            Facebook
          </button>
          <button
            type="button"
            onClick={()=>setPlatform('instagram')}
            style={{
              padding:'12px 14px',
              border:'1px solid ' + (platform==='instagram' ? '#111' : '#ddd'),
              background: platform==='instagram' ? '#111' : '#fff',
              color: platform==='instagram' ? '#fff' : '#111',
              borderRadius: 10,
              cursor:'pointer'
            }}
          >
            Instagram
          </button>
        </div>
      </Card>

      {/* AI-forslag — samlet i én Card med handling i headeren */}
      <Card
        title={platform ? `AI-forslag til ${platform === 'facebook' ? 'Facebook' : 'Instagram'}` : 'AI-forslag'}
        headerRight={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button
              onClick={refreshSuggestions}
              disabled={loadingSug || !platform}
              style={{
                padding:'8px 10px', border:'1px solid #111',
                background: !platform ? '#f2f2f2' : '#111',
                color: !platform ? '#999' : '#fff',
                borderRadius:8, cursor: !platform ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingSug ? 'Henter…' : 'Få 3 nye'}
            </button>
            {sugErr && <span style={{ color:'#b00', fontSize:12 }}>{sugErr}</span>}
          </div>
        }
      >
        <div style={{ display:'flex', gap: 12, alignItems:'stretch', flexWrap: 'wrap' }}>
          {[0,1,2].map((i) => {
            const meta = platform ? metas[platform as 'facebook'|'instagram'][i] : null;
            return (
              <Card
                key={i}
                title={platform ? `Forslag ${i+1} (${meta?.type || '—'})` : `Forslag ${i+1}`}
                style={{ flex:'1 1 0', minWidth: 260 }}
                footer={
                  <button
                    disabled={!suggestions[i]}
                    onClick={() => suggestions[i] && pickSuggestion(suggestions[i])}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, cursor:'pointer' }}
                  >
                    Brug dette
                  </button>
                }
              >
                {/* Meta chips */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: 8 }}>
                  {meta ? (
                    <>
                      {chip(meta.engagement === 'Høj' ? 'Engagement: Høj' : 'Engagement: Mellem')}
                      {chip('Bedst: ' + meta.bestTime)}
                    </>
                  ) : (
                    chip('Vælg platform for målrettede forslag')
                  )}
                </div>
                <div style={{ whiteSpace:'pre-wrap', fontSize:14, minHeight: 90 }}>
                  {loadingSug ? 'Henter…' : (suggestions[i] || '—')}
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* TO-KOLONNE LAYOUT: Hurtigt opslag (venstre) + Foto & video (højre) */}
      <div
        style={{
          display:'grid',
          gap:12,
          gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))',
          alignItems:'start'
        }}
      >
        {/* Hurtigt opslag */}
        <Card title={`Hurtigt opslag ${platform ? `(${platform === 'facebook' ? 'Facebook' : 'Instagram'})` : ''}`} id="quick-post">
          <div style={{ display:'grid', gap: 8 }}>
            <label style={label}>Titel (valgfri)</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} />

            <label style={label}>Tekst</label>
            <textarea
              rows={6}
              value={body}
              onChange={e=>setBody(e.target.value)}
              placeholder={
                platform === 'instagram'
                  ? 'Skriv din billedtekst… brug evt. emojis og 5-10 hashtags.'
                  : platform === 'facebook'
                    ? 'Skriv dit opslag… stil gerne et spørgsmål for at få flere kommentarer.'
                    : 'Sæt et AI-forslag ind eller skriv selv…'
              }
            />

            {/* Mini AI-assistent */}
            <div style={{ display:'flex', gap: 8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize: 12, color:'#666' }}>Tone:</span>
              <select value={tone} onChange={e=>setTone(e.target.value as Tone)}>
                <option value="neutral">Neutral/Venlig</option>
                <option value="tilbud">Tilbud</option>
                <option value="informativ">Informativ</option>
                <option value="hyggelig">Hyggelig</option>
              </select>

              <button type="button" onClick={improveWithAI} style={btn}>
                Forbedr med AI
              </button>
              <button type="button" onClick={saveDraft} disabled={saving} style={btn}>
                {saving ? 'Gemmer…' : 'Gem som udkast'}
              </button>
              <Link href="/posts" style={pillLink}>Gå til dine opslag →</Link>
            </div>

            {/* Billede knyttet til opslaget (fra Foto & video) */}
            {quickImageUrl && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={quickImageUrl}
                  alt="Valgt billede"
                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #eee' }}
                />
              </div>
            )}

            {/* Tips pr. platform */}
            {platform === 'instagram' && (
              <div style={{ fontSize:12, color:'#666' }}>
                💡 Tip: Brug 5-10 hashtags, emojis og et spørgsmål for at øge engagement.
              </div>
            )}
            {platform === 'facebook' && (
              <div style={{ fontSize:12, color:'#666' }}>
                💡 Tip: Opslag med spørgsmål får ofte flere kommentarer. Del gerne en personlig vinkel.
              </div>
            )}
          </div>

          {statusMsg && <p style={{ marginTop: 8, color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>{statusMsg}</p>}
        </Card>

        {/* Foto & video */}
        <Card title="Foto & video">
          {/* Trin 1 — Upload */}
          {!photoPreview ? (
            <div
              style={{
                border:'2px dashed #ddd', borderRadius:12, padding:20,
                minHeight:140, display:'grid', placeItems:'center'
              }}
            >
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:16, marginBottom:6 }}>1) Upload et billede</div>
                <div style={{ color:'#666', marginBottom: 10 }}>
                  Få hurtigt preview nu. (Beskæring/AI-forbedring kommer i næste trin)
                </div>
                <label
                  style={{
                    display:'inline-block', padding:'10px 14px',
                    border:'1px solid #111', borderRadius:8,
                    cursor:'pointer', background:'#111', color:'#fff'
                  }}
                >
                  Vælg fil
                  <input type="file" accept="image/*" onChange={onPickLocalPhoto} style={{ display:'none' }} />
                </label>
              </div>
            </div>
          ) : (
            <>
              <img
                src={photoPreview}
                alt="Preview"
                style={{ width:'100%', maxHeight:260, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }}
              />

              {/* Trin 2 — Analyser */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                <button type="button" onClick={usePhotoInPost} style={btn}>Brug i opslag</button>
                <button
                  type="button"
                  onClick={analyzePhoto}
                  disabled={!platform || isAnalyzing}
                  style={{
                    ...btn,
                    background: !platform ? '#f2f2f2' : '#111',
                    color: !platform ? '#999' : '#fff',
                    cursor: !platform ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isAnalyzing ? 'Analyserer…' : '2) Analyser billede'}
                </button>
              </div>

              {/* Trin 3 — Resultat & forslag */}
              {analysis && (
                <div style={{ marginTop: 12, display:'grid', gap:10 }}>
                  {/* Prosatekst */}
                  <section style={{ padding:12, border:'1px solid #eee', borderRadius:8, background:'#fafafa' }}>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Analyse</div>
                    <p style={{ fontSize:14, margin:0 }}>{analysis.summary}</p>
                    {analysis.overlayTip && (
                      <p style={{ fontSize:12, color:'#666', marginTop:6 }}>
                        Tip: {analysis.overlayTip}
                      </p>
                    )}
                  </section>

                  {/* 1. Beskæring & komposition */}
                  <section style={{ padding:12, border:'1px solid #eee', borderRadius:8 }}>
                    <div style={{ fontWeight:600, marginBottom:8 }}>1) Beskæring & komposition</div>
                    <div style={{ display:'grid', gap:8 }}>
                      {analysis.crop.map(opt => (
                        <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, opacity: opt.locked ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={!!opt.locked}
                            checked={chosen.has(opt.id)}
                            onChange={()=>toggleChoice(opt.id)}
                          />
                          <span style={{ fontSize:14 }}>{opt.label}</span>
                          {opt.description && <span style={{ fontSize:12, color:'#666' }}>— {opt.description}</span>}
                          {opt.locked && <span style={{ marginLeft:'auto', fontSize:12 }}>🔒 Pro/Premium</span>}
                        </label>
                      ))}
                    </div>
                  </section>

                  {/* 2. Rengøring */}
                  <section style={{ padding:12, border:'1px solid #eee', borderRadius:8 }}>
                    <div style={{ fontWeight:600, marginBottom:8 }}>2) Rengøring</div>
                    <div style={{ display:'grid', gap:8 }}>
                      {analysis.cleanup.map(opt => (
                        <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, opacity: opt.locked ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={!!opt.locked}
                            checked={chosen.has(opt.id)}
                            onChange={()=>toggleChoice(opt.id)}
                          />
                          <span style={{ fontSize:14 }}>{opt.label}</span>
                          {opt.locked && <span style={{ marginLeft:'auto', fontSize:12 }}>🔒 Pro/Premium</span>}
                        </label>
                      ))}
                      {/* Basis-handling for Gratis/Basic */}
                      <div style={{ fontSize:12, color:'#666' }}>
                        Gratis/Basic: Skjul distraktioner via beskæring. AI-fjernelse kræver opgradering.
                      </div>
                    </div>
                  </section>

                  {/* 3. Farver & lys */}
                  <section style={{ padding:12, border:'1px solid #eee', borderRadius:8 }}>
                    <div style={{ fontWeight:600, marginBottom:8 }}>3) Farver & lys</div>
                    <div style={{ display:'grid', gap:8 }}>
                      {analysis.color.map(opt => (
                        <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, opacity: opt.locked ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={!!opt.locked}
                            checked={chosen.has(opt.id)}
                            onChange={()=>toggleChoice(opt.id)}
                          />
                          <span style={{ fontSize:14 }}>{opt.label}</span>
                          {opt.locked && <span style={{ marginLeft:'auto', fontSize:12 }}>🔒 Pro/Premium</span>}
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

/* ---------- styles (lokale, simple) ---------- */

const label: React.CSSProperties = { fontSize:12, color:'#666' };

const btn: React.CSSProperties = {
  padding:'8px 10px',
  border:'1px solid #111',
  background:'#111',
  color:'#fff',
  borderRadius:8,
  cursor:'pointer'
};

const pillLink: React.CSSProperties = {
  display:'inline-block',
  fontSize:12,
  border:'1px solid #ddd',
  borderRadius:999,
  padding:'4px 10px',
  background:'#fafafa',
  textDecoration:'none',
  color:'inherit'
};

/* ---------- mock analyse (fase 1) ---------- */

function buildMockAnalysis(platform: Exclude<Platform, ''>): PhotoAnalysisResult {
  const isIG = platform === 'instagram';
  // platform-specifikke beskæringsforslag
  const crop = isIG
    ? [
        { id:'crop-1-1',  label:'1:1 (1080×1080) – fylder fint i feed' },
        { id:'crop-4-5',  label:'4:5 (1080×1350) – fylder mest i IG-feed' },
        { id:'auto-thirds', label:'Auto-komposition: flyt motiv mod tredjedel', description:'Vis gitter og justér udsnit' }
      ]
    : [
        { id:'crop-4-5',   label:'4:5 (1080×1350) – mobil-venlig visning' },
        { id:'crop-1-91-1',label:'1.91:1 (1200×630) – bred link-agtig visning' },
        { id:'auto-thirds', label:'Auto-komposition: flyt motiv mod tredjedel', description:'Vis gitter og justér udsnit' }
      ];

  const cleanup = [
    { id:'trim-left-3',   label:'Beskær 3% i venstre side for at fjerne telefon i hjørnet' },
    { id:'remove-spoon',  label:'AI-fjern “skeen til højre” (stjæler fokus)', locked:true },
    { id:'reduce-carafe', label:'Reducer synlighed af vandkaraffel (blur/slet)', locked:true }
  ];

  const color = [
    { id:'warm-cafe',   label:'Giv billedet mere varme – hyggelig “café-belysning”' },
    { id:'pop-contrast',label:'Lidt mere kontrast/mætning – fx rød sorbet/vin popper' },
    { id:'hero-light',  label:'Lidt ekstra lys på hovedmotiv (“hero shot”)' },
    { id:'nordic-matte',label:'Alternativ: råt nordisk look (dæmp farver, let mat)' }
  ];

  const baseSummary =
    'Dette billede har et stærkt potentiale til engagement på sociale medier. Det naturlige lys og de skarpe detaljer fungerer godt – optimer beskæring for mobilen og fremhæv hovedmotivet.';

  return {
    summary: baseSummary + (isIG
      ? ' Instagram prioriterer vertikale/kvadratiske formater. 4:5 fylder mest i feedet.'
      : ' På Facebook kan du vælge 4:5 til mobil eller 1.91:1 til bred visning.'),
    overlayTip: 'Hold fokus på hovedmotiv – undgå for meget luft. Brug tredjedels-gitter som pejlemærke.',
    crop,
    cleanup,
    color
  };
}
