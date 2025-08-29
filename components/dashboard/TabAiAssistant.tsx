'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Card from './Card';
import PhotoSuggestions, { Suggestion } from './PhotoSuggestions';

type Tone = 'neutral' | 'tilbud' | 'informativ' | 'hyggelig';
type Platform = '' | 'facebook' | 'instagram';

type SuggestionMeta = {
  type: string;
  engagement: 'Høj' | 'Mellem';
  bestTime: string;
};

export default function TabAiAssistant({ onAiTextUse }: { onAiTextUse?: () => void }) {
  // -------- Platform-valg --------
  const [platform, setPlatform] = useState<Platform>('');

  // -------- AI-forslag (tekst) --------
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);

  // -------- Hurtigt opslag --------
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<Tone>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // -------- Foto & video (upload/preview + AI) --------
  const [photoPreview, setPhotoPreview] = useState<string>('');     // original (ObjectURL)
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string>('');     // “AI”-version (preview)
  const [compareOpen, setCompareOpen] = useState(false);            // side-by-side toggle
  const [usingAiInPost, setUsingAiInPost] = useState<boolean>(false);
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');   // bundet til “Hurtigt opslag”

  // -------- Foto-forslag (valgbar liste) --------
  const MAX_PHOTO_CHOICES = 5;

  const photoItems: Suggestion[] = useMemo(() => {
    const cropIG: Suggestion[] = [
      {
        id: 'crop:ig:1-1',
        title: 'Crop closer to the main subject',
        subtitle: 'Square 1:1 (1080×1080) – fills the feed evenly.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:ig:4-5'],
      },
      {
        id: 'crop:ig:4-5',
        title: 'Portrait crop for more feed space',
        subtitle: 'Portrait 4:5 (1080×1350) – performs well on IG feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:ig:1-1'],
      },
    ];
    const cropFB: Suggestion[] = [
      {
        id: 'crop:fb:4-5',
        title: 'Mobile-first portrait crop',
        subtitle: '4:5 (1080×1350) – nice on FB mobile feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:fb:1.91-1'],
      },
      {
        id: 'crop:fb:1.91-1',
        title: 'Wide link-style crop',
        subtitle: '1.91:1 (1200×630) – classic wide look in feed.',
        category: 'cropping',
        tag: 'cropping',
        excludes: ['crop:fb:4-5'],
      },
    ];

    const cleaning: Suggestion[] = [
      {
        id: 'clean:remove-phone',
        title: 'Remove phone in top left',
        subtitle: 'The phone distracts and steals attention.',
        category: 'cleaning',
        tag: 'cleaning',
      },
      {
        id: 'clean:remove-spoon',
        title: 'Remove random spoon',
        subtitle: 'The spoon looks out of place.',
        category: 'cleaning',
        tag: 'cleaning',
      },
      {
        id: 'clean:reduce-carafe',
        title: 'Reduce water carafe visibility',
        subtitle: 'Make dessert and wine the main characters.',
        category: 'cleaning',
        tag: 'cleaning',
      },
    ];

    const color: Suggestion[] = [
      {
        id: 'color:warm',
        title: 'Warm café tone',
        subtitle: 'Cozy, inviting “café light”.',
        category: 'color',
        tag: 'color',
        excludes: ['color:cool'],
      },
      {
        id: 'color:cool',
        title: 'Cool Nordic look',
        subtitle: 'Muted colors with a soft matte feel.',
        category: 'color',
        tag: 'color',
        excludes: ['color:warm'],
      },
    ];

    const crops = platform === 'instagram' ? cropIG : platform === 'facebook' ? cropFB : [];
    return [...crops, ...cleaning, ...color];
  }, [platform]);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSelectedPhotoIds(new Set()); setAiPreviewUrl(''); setCompareOpen(false); setUsingAiInPost(false); }, [platform]);

  function togglePhotoSuggestion(id: string) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      const clicked = photoItems.find(i => i.id === id);
      if (!clicked) return next;

      if (next.has(id)) {
        next.delete(id);
        return next;
      }

      // enforce max
      if (!next.has(id) && next.size >= MAX_PHOTO_CHOICES) {
        return next; // ignorer ekstra valg
      }

      // gensidig eksklusion
      (clicked.excludes || []).forEach(ex => next.delete(ex));
      photoItems.forEach(it => {
        if (it.excludes?.includes(id)) next.delete(it.id);
      });
      next.add(id);
      return next;
    });
  }

  // ---- Metachips (kun UI for tekstforslag) ----
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

  // Reset tekstforslag ved platformskift
  useEffect(() => { setSuggestions([]); setSugErr(null); }, [platform]);

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
      setTitle(''); setBody('');
      // quickImageUrl beholdes; kan bruges igen
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // Foto (lokal preview)
  function onPickLocalPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
    setAiPreviewUrl('');
    setCompareOpen(false);
    setUsingAiInPost(false);
  }

  function applyPhotoEdits() {
    if (!photoPreview || selectedPhotoIds.size === 0) return;
    // For nu: brug samme URL og vis AI-look via CSS-filter i UI (se img style)
    setAiPreviewUrl(photoPreview);
    setCompareOpen(true);
  }

  function useOriginalInPost() {
    if (!photoPreview) return;
    setQuickImageUrl(photoPreview);
    setUsingAiInPost(false);
    scrollToQuick();
  }

  function useAiInPost() {
    if (!aiPreviewUrl) return;
    setQuickImageUrl(aiPreviewUrl);
    setUsingAiInPost(true);
    scrollToQuick();
  }

  function clearPhoto() {
    setPhotoPreview('');
    setAiPreviewUrl('');
    setCompareOpen(false);
    setUsingAiInPost(false);
    setSelectedPhotoIds(new Set());
  }

  // Simpel tekst-billede match score (placeholder)
  const matchScore = useMemo(() => {
    if (!quickImageUrl && !photoPreview) return null;
    let score = 60;
    if (body.length > 120) score += 10;
    if (/\b(kaffe|café|kage|dessert|morgen|hygg|varm|kold)\b/i.test(body)) score += 15;
    if (platform) score += 5;
    return Math.min(95, score);
  }, [body, quickImageUrl, photoPreview, platform]);

  // ---------- Scheduling (Gratis: ICS-download) ----------
  const [schedDate, setSchedDate] = useState<string>('');
  const [schedTime, setSchedTime] = useState<string>('');
  const [bestTimeHint, setBestTimeHint] = useState<string | null>(null);

  function downloadICS() {
    if (!schedDate || !schedTime) return;
    const dt = new Date(`${schedDate}T${schedTime}:00`);
    const dtEnd = new Date(dt.getTime() + 30 * 60 * 1000);
    const uid = `${Date.now()}@post2grow`;
    const titleLine = (title || 'Planlagt opslag') + (platform ? ` (${platform})` : '');
    const desc = (body || '').replace(/\n/g, '\\n');
    const pad = (n:number)=>String(n).padStart(2,'0');
    const fmt = (d:Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Post2Grow//Scheduler//DA',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dt)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${titleLine}`,
      `DESCRIPTION:${desc}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'post2grow-opslag.ics';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // UI helpers
  const chip = (text: string) => (
    <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #eee', borderRadius: 999, background:'#fafafa' }}>
      {text}
    </span>
  );

  // Prosa til billedvurdering (placeholder)
  const prose =
    'Dette billede har et stærkt potentiale på sociale medier. ' +
    'Naturligt lys og tydeligt hovedmotiv fungerer godt på mobil. ' +
    'Overvej at beskære til det valgte format og finjustere farver/lys for mere “pop”.';

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
              borderRadius: 10, cursor:'pointer'
            }}
          >Facebook</button>
          <button
            type="button"
            onClick={()=>setPlatform('instagram')}
            style={{
              padding:'12px 14px',
              border:'1px solid ' + (platform==='instagram' ? '#111' : '#ddd'),
              background: platform==='instagram' ? '#111' : '#fff',
              color: platform==='instagram' ? '#fff' : '#111',
              borderRadius: 10, cursor:'pointer'
            }}
          >Instagram</button>
        </div>
      </Card>

      {/* AI-forslag (tekst) + Handling */}
      <Card
        title={platform ? `AI-forslag til ${platform === 'facebook' ? 'Facebook' : 'Instagram'}` : 'AI-forslag'}
        headerRight={
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
        }
      >
        <div style={{ display:'flex', gap:12, alignItems:'stretch', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:12, flex:'1 1 auto', minWidth:260 }}>
            {[0,1,2].map((i) => {
              const meta = platform ? metas[platform as 'facebook'|'instagram'][i] : null;
              return (
                <Card
                  key={i}
                  title={platform ? `Forslag (${meta?.type || '—'})` : 'Forslag'}
                  style={{ flex:'1 1 0', minWidth:260 }}
                  footer={
                    <button
                      disabled={!suggestions[i]}
                      onClick={() => suggestions[i] && pickSuggestion(suggestions[i])}
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, cursor:'pointer' }}
                    >Brug dette</button>
                  }
                >
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                    {meta ? (<>
                      {chip(meta.engagement === 'Høj' ? 'Engagement: Høj' : 'Engagement: Mellem')}
                      {chip('Bedst: ' + meta.bestTime)}
                    </>) : chip('Vælg platform for målrettede forslag')}
                  </div>
                  <div style={{ whiteSpace:'pre-wrap', fontSize:14, minHeight: 90 }}>
                    {loadingSug ? 'Henter…' : (suggestions[i] || '—')}
                  </div>
                </Card>
              );
            })}
          </div>
          {sugErr && <div style={{ color:'#b00', fontSize:13 }}>{sugErr}</div>}
        </div>
      </Card>

      {/* TO-KOLONNE: Hurtigt opslag (venstre) + Foto & video (højre) */}
      <div
        style={{
          display:'grid', gap:12,
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

            {/* Vedhæftet foto til dette opslag */}
            {(quickImageUrl || photoPreview) && (
              <div style={{
                display:'flex', alignItems:'center', gap:10, padding:10,
                border:'1px solid #eee', borderRadius:10, background:'#fafafa'
              }}>
                <img
                  src={(usingAiInPost ? aiPreviewUrl : (quickImageUrl || photoPreview))}
                  alt="Vedhæftet"
                  style={{
                    width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #eee',
                    // vis AI-look via filter (kun i UI – ikke i filen)
                    filter: usingAiInPost ? 'contrast(1.08) saturate(1.08)' : 'none'
                  }}
                />
                <div style={{ display:'grid', gap:6 }}>
                  <div style={{ fontSize:12, color:'#666' }}>
                    Vedhæftet billede: <strong>{usingAiInPost ? 'AI-version' : 'Original'}</strong>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {!!photoPreview && (
                      <button type="button" onClick={useOriginalInPost} style={btnSecondary}>
                        Brug original
                      </button>
                    )}
                    {!!aiPreviewUrl && (
                      <button type="button" onClick={useAiInPost} style={btnSecondary}>
                        Brug AI-version
                      </button>
                    )}
                    {aiPreviewUrl && (
                      <button type="button" onClick={()=>setCompareOpen(v=>!v)} style={btnSecondary}>
                        {compareOpen ? 'Skjul sammenligning' : 'Vis sammenligning'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Match-score */}
            {matchScore !== null && (
              <div style={{ fontSize:12, color:'#444' }}>
                🔎 Tekst ↔︎ billede-match: <strong>{matchScore}%</strong>
              </div>
            )}

            {/* Mini AI-assistent */}
            <div style={{ display:'flex', gap: 8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize: 12, color:'#666' }}>Tone:</span>
              <select value={tone} onChange={e=>setTone(e.target.value as Tone)}>
                <option value="neutral">Neutral/Venlig</option>
                <option value="tilbud">Tilbud</option>
                <option value="informativ">Informativ</option>
                <option value="hyggelig">Hyggelig</option>
              </select>
              <button type="button" onClick={improveWithAI} style={btn}>Forbedr med AI</button>
              <button type="button" onClick={saveDraft} disabled={saving} style={btn}>
                {saving ? 'Gemmer…' : 'Gem som udkast'}
              </button>
              <Link href="/posts" style={pillLink}>Gå til dine opslag →</Link>
            </div>

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
          <div style={{ display:'grid', gap:10 }}>
            {!photoPreview ? (
              <div
                style={{
                  border:'2px dashed #ddd', borderRadius:12, padding:20,
                  minHeight:140, display:'grid', placeItems:'center'
                }}
              >
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, marginBottom:6 }}>Upload et billede</div>
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
                {/* Prosa-vurdering */}
                <div style={{ padding:10, border:'1px solid #eee', borderRadius:10, background:'#fafafa' }}>
                  <div style={{ fontWeight:600, marginBottom:6 }}>AI vurdering</div>
                  <div style={{ fontSize:14, color:'#333' }}>{prose}</div>
                </div>

                {/* Preview eller sammenligning */}
                {!compareOpen ? (
                  <img
                    src={aiPreviewUrl || photoPreview}
                    alt="Preview"
                    style={{
                      width:'100%', maxHeight:260, objectFit:'cover', borderRadius:8, border:'1px solid #eee',
                      filter: aiPreviewUrl ? 'contrast(1.08) saturate(1.08)' : 'none'
                    }}
                  />
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div>
                      <div style={{ fontSize:12, marginBottom:4, color:'#666' }}>Original</div>
                      <img src={photoPreview} alt="Original"
                           style={{ width:'100%', maxHeight:240, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:12, marginBottom:4, color:'#666' }}>AI-version (preview)</div>
                      <img
                        src={aiPreviewUrl || photoPreview}
                        alt="AI"
                        style={{
                          width:'100%', maxHeight:240, objectFit:'cover', borderRadius:8, border:'1px solid #eee',
                          filter: 'contrast(1.08) saturate(1.08)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Knapper under preview */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button type="button" onClick={useOriginalInPost} style={btnSecondary}>Brug original i opslag</button>
                  <button
                    type="button"
                    onClick={applyPhotoEdits}
                    disabled={selectedPhotoIds.size === 0}
                    style={{
                      ...btn,
                      opacity: selectedPhotoIds.size === 0 ? 0.6 : 1,
                      cursor: selectedPhotoIds.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Anvend ændringer (AI-preview)
                  </button>
                  {aiPreviewUrl && (
                    <button type="button" onClick={useAiInPost} style={btnSecondary}>
                      Brug AI-version i opslag
                    </button>
                  )}
                  <button type="button" onClick={()=>setCompareOpen(v=>!v)} style={btnSecondary}>
                    {compareOpen ? 'Skjul sammenligning' : 'Vis sammenligning'}
                  </button>
                  <button type="button" onClick={clearPhoto} style={{ ...btnSecondary, background:'#fafafa' }}>Nulstil</button>
                </div>

                {/* Forslag + tæller + bar */}
                <div style={{ marginTop: 10 }}>
                  <PhotoSuggestions
                    items={photoItems}
                    selected={selectedPhotoIds}
                    onToggle={togglePhotoSuggestion}
                  />
                  <div style={{ marginTop:8, fontSize:12, color:'#444', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, height:8, background:'#eee', borderRadius:999, overflow:'hidden' }}>
                      <div
                        style={{
                          height:'100%', width: `${(selectedPhotoIds.size / MAX_PHOTO_CHOICES) * 100}%`,
                          background:'#111', borderRadius:999, transition:'width .2s'
                        }}
                      />
                    </div>
                    <span>{selectedPhotoIds.size}/{MAX_PHOTO_CHOICES} valgt</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Planlæg & udgiv */}
      <Card title="Planlæg & udgiv (Gratis)">
        <div style={{ display:'grid', gap:10, maxWidth:520 }}>
          <div style={{ display:'grid', gap:6, gridTemplateColumns:'1fr 1fr' }}>
            <div>
              <label style={label}>Dato</label>
              <input type="date" value={schedDate} onChange={e=>setSchedDate(e.target.value)} />
            </div>
            <div>
              <label style={label}>Tidspunkt</label>
              <input type="time" value={schedTime} onChange={e=>setSchedTime(e.target.value)} />
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button type="button" onClick={downloadICS} disabled={!schedDate || !schedTime} style={btn}>
              Download kalenderfil (.ics)
            </button>
            <button type="button" disabled style={btnDisabled}>
              🔒 Få forslag til bedste tidspunkt (Pro)
            </button>
            <button type="button" disabled style={btnDisabled}>
              🔒 Autopost til valgte kanaler (Pro/Premium)
            </button>
          </div>

          {bestTimeHint && (
            <div style={{ fontSize:12, color:'#666' }}>Forslag: {bestTimeHint}</div>
          )}
        </div>
      </Card>
    </section>
  );
}

/* ---------- styles ---------- */

const label: React.CSSProperties = { fontSize:12, color:'#666' };

const btn: React.CSSProperties = {
  padding:'8px 10px',
  border:'1px solid #111',
  background:'#111',
  color:'#fff',
  borderRadius:8,
  cursor:'pointer'
};

const btnSecondary: React.CSSProperties = {
  padding:'8px 10px',
  border:'1px solid #111',
  background:'#fff',
  color:'#111',
  borderRadius:8,
  cursor:'pointer'
};

const btnDisabled: React.CSSProperties = {
  padding:'8px 10px',
  border:'1px dashed #ccc',
  background:'#f6f6f6',
  color:'#999',
  borderRadius:8,
  cursor:'not-allowed'
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
