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

  // -------- Foto & video (upload/preview) --------
  const [photoPreview, setPhotoPreview] = useState<string>('');   // original preview
  const [editedUrl, setEditedUrl] = useState<string>('');         // AI-redigeret (stub)
  const [imageMode, setImageMode] = useState<'original'|'ai'>('original'); // hvilken der vises/bruges
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  // Tekst-delen bruger dette som "valgte foto"
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');

  const displayUrl = imageMode === 'ai' && editedUrl ? editedUrl : photoPreview;

  // -------- Foto-forslag --------
  const photoItems: Suggestion[] = useMemo(() => {
    const cropIG: Suggestion[] = [
      { id: 'crop:ig:1-1',  title: 'Crop closer to the main subject', subtitle: 'Square 1:1 (1080×1080) – fills the feed evenly.', category: 'cropping', tag: 'cropping', excludes: ['crop:ig:4-5'] },
      { id: 'crop:ig:4-5',  title: 'Portrait crop for more feed space', subtitle: 'Portrait 4:5 (1080×1350) – performs well on IG feed.',  category: 'cropping', tag: 'cropping', excludes: ['crop:ig:1-1'] },
    ];
    const cropFB: Suggestion[] = [
      { id: 'crop:fb:4-5',    title: 'Mobile-first portrait crop', subtitle: '4:5 (1080×1350) – nice on FB mobile feed.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:1.91-1'] },
      { id: 'crop:fb:1.91-1', title: 'Wide link-style crop',       subtitle: '1.91:1 (1200×630) – classic wide look in feed.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:4-5'] },
    ];
    const cleaning: Suggestion[] = [
      { id: 'clean:remove-phone',  title: 'Remove phone in top left', subtitle: 'The phone distracts and steals attention.', category: 'cleaning', tag: 'cleaning' },
      { id: 'clean:remove-spoon',  title: 'Remove random spoon',      subtitle: 'The spoon looks out of place.',            category: 'cleaning', tag: 'cleaning' },
      { id: 'clean:reduce-carafe', title: 'Reduce water carafe visibility', subtitle: 'Make dessert and wine the main characters.', category: 'cleaning', tag: 'cleaning' },
    ];
    const color: Suggestion[] = [
      { id: 'color:warm', title: 'Warm café tone',  subtitle: 'Cozy, inviting “café light”.', category: 'color', tag: 'color', excludes: ['color:cool'] },
      { id: 'color:cool', title: 'Cool Nordic look',subtitle: 'Muted colors with a soft matte feel.', category: 'color', tag: 'color', excludes: ['color:warm'] },
    ];
    const crops = platform === 'instagram' ? cropIG : platform === 'facebook' ? cropFB : [];
    return [...crops, ...cleaning, ...color];
  }, [platform]);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSelectedPhotoIds(new Set()); setEditedUrl(''); setImageMode('original'); }, [platform]);

  function togglePhotoSuggestion(id: string) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      const clicked = photoItems.find(i => i.id === id);
      if (!clicked) return next;

      if (next.has(id)) {
        next.delete(id);
      } else {
        (clicked.excludes || []).forEach(ex => next.delete(ex));
        photoItems.forEach(it => { if (it.excludes?.includes(id)) next.delete(it.id); });
        next.add(id);
      }
      return next;
    });
  }

  // Tæller (maks = 1 crop + N cleaning + 1 color)
  const totalPossible = useMemo(() => {
    const hasCrop = photoItems.some(i => i.category === 'cropping');
    const hasColor = photoItems.some(i => i.category === 'color');
    const cleaners = photoItems.filter(i => i.category === 'cleaning').length;
    return (hasCrop ? 1 : 0) + cleaners + (hasColor ? 1 : 0);
  }, [photoItems]);

  // ---- Metachips (kun UI for tekstforslag) ----
  const metas: Record<'facebook' | 'instagram', SuggestionMeta[]> = useMemo(() => ({
    facebook: [
      { type: 'Community', engagement: 'Høj', bestTime: 'kl. 13:00' },
      { type: 'Spørgsmål', engagement: 'Mellem', bestTime: 'kl. 15:00' },
      { type: 'Lærings-tip', engagement: 'Høj', bestTime: 'kl. 11:00' },
    ],
    instagram: [
      { type: 'Visuel story', engagement: 'Høj', bestTime: 'kl. 14:00' },
      { type: 'Lifestyle', engagement: 'Høj', bestTime: 'kl. 08:00' },
      { type: 'Trending', engagement: 'Mellem', bestTime: 'kl. 18:00' },
    ],
  }), []);

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
        body: JSON.stringify({ topic: 'Idéer til opslag for en lokal virksomhed.' + channelHint, tone: 'neutral' })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);
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

      setStatusMsg('Gemt som udkast ✔'); setTitle(''); setBody('');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // Foto (lokal preview)
  function onPickLocalPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
    setEditedUrl('');
    setImageMode('original');
  }
  function usePhotoInPost() {
    if (!displayUrl) return;
    setQuickImageUrl(displayUrl);
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function resetPhoto() {
    setPhotoPreview('');
    setEditedUrl('');
    setImageMode('original');
    setSelectedPhotoIds(new Set());
    setApplyMsg(null);
  }

  // Anvend valgte ændringer (stub – sætter editedUrl = photoPreview for nu)
  async function applyEdits() {
    if (!photoPreview) { setApplyMsg('Upload et billede først.'); return; }
    if (selectedPhotoIds.size === 0) { setApplyMsg('Vælg mindst ét forslag.'); return; }
    setApplyMsg('Anvender ændringer…');
    // TODO: Kald din /api/media/edit med { photoPreview, selectedPhotoIds, platform }
    // For nu simulerer vi resultat:
    setTimeout(() => {
      setEditedUrl(photoPreview);     // i MVP viser vi samme billede
      setImageMode('ai');
      setApplyMsg('Ændringer anvendt (demo) ✔');
    }, 500);
  }

  // --- Planlæg & udgiv (UI-stub) ---
  const [planDate, setPlanDate] = useState<string>('');
  const [planTime, setPlanTime] = useState<string>('');
  const [planNote, setPlanNote]   = useState<string>('');
  function planStub() {
    alert(`(Demo) Plan sat: ${planDate || '—'} ${planTime || ''}\nPlatform: ${platform || '—'}\nNote: ${planNote || '—'}`);
  }

  // UI helpers
  const chip = (text: string) => (
    <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #eee', borderRadius: 999, background:'#fafafa' }}>
      {text}
    </span>
  );

  const selectedCount = selectedPhotoIds.size;
  const progressPct = totalPossible ? Math.min(100, Math.round((selectedCount / totalPossible) * 100)) : 0;

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

      {/* AI-forslag (tekst) + Handling i højre hjørne */}
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

      {/* TO-KOLONNE LAYOUT med faste rammer og intern scroll */}
      <div
        style={{
          display:'grid', gap:12,
          gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))',
          alignItems:'start'
        }}
      >
        {/* A) Hurtigt opslag – fast højde, scroll indeni */}
        <Card
          title={`Hurtigt opslag ${platform ? `(${platform === 'facebook' ? 'Facebook' : 'Instagram'})` : ''}`}
          id="quick-post"
          style={{ height: PANEL_HEIGHT, overflow:'hidden' }}
        >
          <div style={scrollArea}>
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

              {quickImageUrl && (
                <div style={{ marginTop: 8 }}>
                  <img src={quickImageUrl} alt="Valgt billede"
                       style={{ maxWidth:'100%', borderRadius:8, border:'1px solid #eee' }} />
                </div>
              )}
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
          </div>
        </Card>

        {/* B) Foto & video – fast højde, BILLEDE FAST + LISTE SCROLLER + FAST FOOTER */}
        <Card title="Foto & video" style={{ height: PANEL_HEIGHT, overflow:'hidden' }}>
          <div
            style={{
              height:'100%',
              display:'grid',
              gridTemplateRows:'auto auto 1fr auto',
              gap:8,
              overflow:'hidden' // forhindrer overlap udenfor kortet
            }}
          >
            {/* (1) Foto (ikke i scroll) */}
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
              <img
                src={displayUrl}
                alt="Preview"
                style={{ width:'100%', maxHeight:220, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }}
              />
            )}

            {/* (2) Vælg Original/AI + knapper (ikke i scroll) */}
            {photoPreview && (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label><input type="radio" name="imgmode" checked={imageMode==='original'} onChange={()=>setImageMode('original')} /> Original</label>
                <label><input type="radio" name="imgmode" checked={imageMode==='ai'} onChange={()=>setImageMode('ai')} disabled={!editedUrl}/> AI redigeret</label>
                <button type="button" onClick={usePhotoInPost} style={btn}>
                  Brug i opslag
                </button>
                <label
                  style={{
                    display:'inline-block', padding:'8px 10px',
                    border:'1px solid #111', borderRadius:8,
                    cursor:'pointer', background:'#fff', color:'#111'
                  }}
                >
                  Erstat billede
                  <input type="file" accept="image/*" onChange={onPickLocalPhoto} style={{ display:'none' }} />
                </label>
                <button type="button" onClick={resetPhoto} style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
                  Fjern
                </button>
              </div>
            )}

            {/* (3) Forslagsliste (den eneste der scroller) */}
            <div style={{ minHeight:0, overflow:'auto' }}>
              {photoPreview && (
                <PhotoSuggestions
                  items={photoItems}
                  selected={selectedPhotoIds}
                  onToggle={togglePhotoSuggestion}
                />
              )}
            </div>

            {/* (4) Bundbjælke – altid synlig */}
            <div style={{
              borderTop:'1px solid #eee',
              paddingTop:8,
              display:'grid',
              gridTemplateColumns:'1fr auto',
              alignItems:'center',
              gap:8
            }}>
              <div>
                <div style={{ fontSize:13, color:'#666', display:'flex', justifyContent:'space-between' }}>
                  <span>Anvendte forslag</span>
                  <strong>{selectedCount} / {totalPossible}</strong>
                </div>
                <div style={{ height:8, background:'#f2f2f5', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ width:`${progressPct}%`, height:'100%', background:'#111' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={()=>setSelectedPhotoIds(new Set())}
                        style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
                  Nulstil
                </button>
                <button
                  type="button"
                  onClick={applyEdits}
                  disabled={!photoPreview || selectedPhotoIds.size === 0}
                  style={btn}
                >
                  Anvend ændringer
                </button>
              </div>
            </div>
            {applyMsg && <div style={{ fontSize:12, color:'#666' }}>{applyMsg}</div>}
          </div>
        </Card>
      </div>

      {/* Planlæg & udgiv – går på tværs */}
      <Card title="Planlæg & udgiv">
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', alignItems:'end' }}>
          <div>
            <label style={label}>Dato</label>
            <input type="date" value={planDate} onChange={e=>setPlanDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Tid</label>
            <input type="time" value={planTime} onChange={e=>setPlanTime(e.target.value)} />
          </div>
          <div>
            <label style={label}>Note (valgfri)</label>
            <input value={planNote} onChange={e=>setPlanNote(e.target.value)} placeholder="Fx ’Mors dag teaser’" />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={planStub} style={btn}>Planlæg</button>
            <button type="button" style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
              Gem som Klar
            </button>
          </div>
        </div>
        <div style={{ marginTop:8, fontSize:12, color:'#666' }}>
          Platform: <strong>{platform ? (platform === 'facebook' ? 'Facebook' : 'Instagram') : '—'}</strong> •
          {quickImageUrl ? ' Billede valgt ✔' : ' Intet billede valgt'}
        </div>
      </Card>
    </section>
  );
}

/* ---------- styles ---------- */

const PANEL_HEIGHT = 640; // lidt højere så der er plads til flere forslag
const scrollArea: React.CSSProperties = {
  height: PANEL_HEIGHT - 48 /* header-estimat */,
  overflow: 'auto',
  display: 'grid',
  alignContent: 'start',
  gap: 8
};

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
