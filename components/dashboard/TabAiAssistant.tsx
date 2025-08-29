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

type ViewMode = 'original' | 'enhanced';

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

  // -------- Foto & video (upload/preview + AI-resultat) --------
  const [photoPreview, setPhotoPreview] = useState<string>('');     // original
  const [enhancedUrl, setEnhancedUrl]   = useState<string>('');     // AI-resultat (stub)
  const [applying, setApplying]         = useState(false);
  const [viewMode, setViewMode]         = useState<ViewMode>('original');

  // Billede knyttet til Hurtigt opslag
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');

  // -------- Foto-forslag (valgbar liste + max-logik) --------
  const { photoItems, maxSelectable } = useMemo(() => {
    const cropIG: Suggestion[] = [
      { id: 'crop:ig:1-1',  title: 'Crop closer to the main subject', subtitle: 'Square 1:1 (1080×1080) – fills the feed evenly.', category: 'cropping', tag: 'cropping', excludes: ['crop:ig:4-5'] },
      { id: 'crop:ig:4-5',  title: 'Portrait crop for more feed space', subtitle: 'Portrait 4:5 (1080×1350) – performs well on IG feed.',  category: 'cropping', tag: 'cropping', excludes: ['crop:ig:1-1'] },
    ];
    const cropFB: Suggestion[] = [
      { id: 'crop:fb:4-5',   title: 'Mobile-first portrait crop', subtitle: '4:5 (1080×1350) – nice on FB mobile feed.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:1.91-1'] },
      { id: 'crop:fb:1.91-1',title: 'Wide link-style crop',       subtitle: '1.91:1 (1200×630) – classic wide look in feed.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:4-5'] },
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
    const items = [...crops, ...cleaning, ...color];

    // Max: alle cleaning + 1 crop (hvis der findes) + 1 color
    const max = cleaning.length + (crops.length ? 1 : 0) + 1;
    return { photoItems: items, maxSelectable: max };
  }, [platform]);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedPhotoIds(new Set());
    setEnhancedUrl('');
    setViewMode('original');
  }, [platform]);

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

  // Reset tekst-forslag ved platformskift
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
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // Foto (lokal preview)
  function onPickLocalPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
    setEnhancedUrl('');
    setViewMode('original');
  }

  function useImageInPost(which: ViewMode) {
    const pick = which === 'enhanced' && enhancedUrl ? enhancedUrl : photoPreview;
    if (!pick) return;
    setQuickImageUrl(pick);
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetEdits() {
    setSelectedPhotoIds(new Set());
    setEnhancedUrl('');
    setViewMode('original');
  }

  // Simuler AI-anvendelse
  async function applySelected() {
    if (!photoPreview) return;
    if (selectedPhotoIds.size === 0) return;
    setApplying(true);
    // (Stub) Her ville vi kalde /api/media/enhance med { photoPreview, platform, selectedPhotoIds }
    await new Promise(r => setTimeout(r, 1200));
    setEnhancedUrl(photoPreview); // demo: samme billede
    setViewMode('enhanced');
    setApplying(false);
  }

  const selectedCount = selectedPhotoIds.size;
  const progressPct = Math.min(100, Math.round((selectedCount / Math.max(1, maxSelectable)) * 100));

  // Lille prosa-feedback
  const prose = useMemo(() => {
    if (!photoPreview) return 'Upload et foto for at få vurdering og forslag.';
    const ch = platform ? (platform === 'facebook' ? 'Facebook' : 'Instagram') : 'din kanal';
    const parts: string[] = [];
    parts.push(`Billedet har fint potentiale til engagement på ${ch}.`);
    if ([...selectedPhotoIds].some(id => id.startsWith('crop'))) parts.push('Den valgte beskæring forbedrer fokus på motivet.');
    if ([...selectedPhotoIds].some(id => id.startsWith('clean'))) parts.push('Rengøring fjerner distraktioner og styrker helhedsindtrykket.');
    if (selectedPhotoIds.has('color:warm')) parts.push('Varm tone giver en hyggelig café-stemning.');
    if (selectedPhotoIds.has('color:cool')) parts.push('Kølig tone giver et rent, nordisk look.');
    return parts.join(' ');
  }, [photoPreview, platform, selectedPhotoIds]);

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
          gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))',
          alignItems:'start'
        }}
      >
        {/* A) Hurtigt opslag – fast højde, scroll indeni */}
        <Card
          title={`Hurtigt opslag ${platform ? `(${platform === 'facebook' ? 'Facebook' : 'Instagram'})` : ''}`}
          id="quick-post"
          style={{ height: PANEL_HEIGHT }}
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

        {/* B) Foto & video – fast højde, foto altid synligt, forslag scroller, sticky footer */}
        <Card title="Foto & video" style={{ height: PANEL_HEIGHT, display:'grid' }}>
          <div style={{ height:'100%', display:'grid', gridTemplateRows:'auto auto 1fr auto', gap:8, overflow:'hidden' }}>
            {/* Top: upload / erstat / fjern + view toggle */}
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
              <div>
                <img
                  src={viewMode === 'enhanced' && enhancedUrl ? enhancedUrl : photoPreview}
                  alt={viewMode === 'enhanced' ? 'AI-resultat' : 'Original'}
                  style={{ width:'100%', maxHeight:260, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }}
                />
                <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                  {/* View toggle */}
                  <div style={{ display:'inline-flex', border:'1px solid #ddd', borderRadius:999, overflow:'hidden' }}>
                    <button
                      type="button"
                      onClick={()=>setViewMode('original')}
                      style={{
                        padding:'6px 10px', background:viewMode==='original' ? '#111' : '#fff',
                        color: viewMode==='original' ? '#fff' : '#111', border:'none', cursor:'pointer'
                      }}
                    >Original</button>
                    <button
                      type="button"
                      onClick={()=>enhancedUrl && setViewMode('enhanced')}
                      disabled={!enhancedUrl}
                      style={{
                        padding:'6px 10px', background:viewMode==='enhanced' ? '#111' : '#fff',
                        color: viewMode==='enhanced' ? '#fff' : (!enhancedUrl ? '#999' : '#111'),
                        border:'none', cursor: !enhancedUrl ? 'not-allowed' : 'pointer'
                      }}
                    >AI-resultat</button>
                  </div>

                  {/* Filhåndtering */}
                  <label
                    style={{
                      display:'inline-block', padding:'6px 10px',
                      border:'1px solid #111', borderRadius:8,
                      cursor:'pointer', background:'#fff', color:'#111'
                    }}
                  >
                    Erstat billede
                    <input type="file" accept="image/*" onChange={onPickLocalPhoto} style={{ display:'none' }} />
                  </label>
                  <button type="button" onClick={()=>{ setPhotoPreview(''); setEnhancedUrl(''); setViewMode('original'); }} style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
                    Fjern
                  </button>
                </div>
              </div>
            )}

            {/* Prosa (kort) */}
            <div style={{ fontSize:12, color:'#444', background:'#fafafa', border:'1px solid #eee', borderRadius:8, padding:8 }}>
              {prose}
            </div>

            {/* Forslag – scroller */}
            <div style={{ overflow:'auto', minHeight: 80 }}>
              {photoPreview ? (
                <PhotoSuggestions
                  items={photoItems}
                  selected={selectedPhotoIds}
                  onToggle={togglePhotoSuggestion}
                  /* NOTE: for at flytte kategori-pill op ved checkmærket,
                     tilføj evt. en prop i PhotoSuggestions og brug den her. */
                />
              ) : (
                <div style={{ color:'#666', fontSize:13 }}>Upload et billede for at se forslag.</div>
              )}
            </div>

            {/* Sticky bundbar: tæller + progress + knapper */}
            <div style={{
              position:'sticky', bottom:0, background:'#fff',
              borderTop:'1px solid #eee', paddingTop:8, display:'grid', gap:8
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div style={{ fontSize:12, color:'#666' }}>
                  Valgt <strong>{selectedCount}</strong> / {maxSelectable}
                </div>
                <div style={{ flex:'1 0 180px', height:8, background:'#eee', borderRadius:999, overflow:'hidden' }}>
                  <div style={{ width:`${progressPct}%`, height:'100%', background:'#111' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button
                  type="button"
                  onClick={applySelected}
                  disabled={!photoPreview || selectedCount === 0 || applying}
                  style={btn}
                >
                  {applying ? 'Anvender…' : `Anvend ${selectedCount} ændring${selectedCount===1?'':'er'}`}
                </button>
                <button
                  type="button"
                  onClick={()=>useImageInPost('original')}
                  disabled={!photoPreview}
                  style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}
                >
                  Brug original i opslag
                </button>
                <button
                  type="button"
                  onClick={()=>useImageInPost('enhanced')}
                  disabled={!enhancedUrl}
                  style={{ ...btn, background: !enhancedUrl ? '#f2f2f2' : '#111', color: !enhancedUrl ? '#999' : '#fff' }}
                >
                  Brug AI-resultat i opslag
                </button>
                <button
                  type="button"
                  onClick={resetEdits}
                  style={{ ...btn, background:'#fff', color:'#111' }}
                >
                  Nulstil
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Planlæg & udgiv – går på tværs */}
      <Card title="Planlæg & udgiv">
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', alignItems:'end' }}>
          <PlanFields platform={platform} quickImageUrl={quickImageUrl} />
        </div>
      </Card>
    </section>
  );
}

/* ---------- små komponenter ---------- */

function PlanFields({ platform, quickImageUrl }: { platform: Platform; quickImageUrl: string }) {
  const [planDate, setPlanDate] = useState<string>('');
  const [planTime, setPlanTime] = useState<string>('');
  const [planNote, setPlanNote] = useState<string>('');
  function planStub() {
    alert(`(Demo) Plan sat: ${planDate || '—'} ${planTime || ''}\nPlatform: ${platform || '—'}\nNote: ${planNote || '—'}`);
  }
  return (
    <>
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
      <div style={{ gridColumn:'1 / -1', marginTop:8, fontSize:12, color:'#666' }}>
        Platform: <strong>{platform ? (platform === 'facebook' ? 'Facebook' : 'Instagram') : '—'}</strong> •
        {quickImageUrl ? ' Billede valgt ✔' : ' Intet billede valgt'}
      </div>
    </>
  );
}

/* ---------- styles ---------- */

const PANEL_HEIGHT = 680; // mere plads til synlige forslag
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
