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
  const [photoPreview, setPhotoPreview] = useState<string>('');   // original (lokal URL)
  const [editedPreview, setEditedPreview] = useState<string>('');  // AI-udgave (mock for nu)
  const [viewMode, setViewMode] = useState<'original' | 'ai'>('original');
  const [applyBusy, setApplyBusy] = useState(false);

  // bruges i "Hurtigt opslag"
  const [quickImageUrl, setQuickImageUrl] = useState<string>('');

  // -------- Foto-forslag (valgbar liste) --------
  const photoItems: Suggestion[] = useMemo(() => {
    const cropIG: Suggestion[] = [
      { id: 'crop:ig:1-1',   title: 'Crop tættere på motivet', subtitle: '1:1 (1080×1080) – fylder feedet jævnt.', category: 'cropping', tag: 'cropping', excludes: ['crop:ig:4-5'] },
      { id: 'crop:ig:4-5',   title: 'Portræt-crop for mere feed-plads', subtitle: '4:5 (1080×1350) – performer godt på IG.', category: 'cropping', tag: 'cropping', excludes: ['crop:ig:1-1'] },
    ];
    const cropFB: Suggestion[] = [
      { id: 'crop:fb:4-5',   title: 'Mobil-først portræt-crop', subtitle: '4:5 (1080×1350) – godt på FB mobil.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:1.91-1'] },
      { id: 'crop:fb:1.91-1',title: 'Bredt link-look', subtitle: '1.91:1 (1200×630) – klassisk bredt feed-format.', category: 'cropping', tag: 'cropping', excludes: ['crop:fb:4-5'] },
    ];

    const cleaning: Suggestion[] = [
      { id: 'clean:remove-phone',  title: 'Fjern telefon i venstre hjørne', subtitle: 'Stjæler opmærksomhed.', category: 'cleaning', tag: 'cleaning' },
      { id: 'clean:remove-spoon',  title: 'Fjern løs ske',                  subtitle: 'Ser malplaceret ud.', category: 'cleaning', tag: 'cleaning' },
      { id: 'clean:reduce-carafe', title: 'Dæmp vandkaraffel',              subtitle: 'Lad dessert og vin spille hovedrollen.', category: 'cleaning', tag: 'cleaning' },
    ];

    const color: Suggestion[] = [
      { id: 'color:warm', title: 'Varm café-tone',   subtitle: 'Hyggelig, indbydende stemning.', category: 'color', tag: 'color', excludes: ['color:cool'] },
      { id: 'color:cool', title: 'Kølig nordisk',    subtitle: 'Dæmpede farver, blød mat følelse.', category: 'color', tag: 'color', excludes: ['color:warm'] },
    ];

    const crops = platform === 'instagram' ? cropIG : platform === 'facebook' ? cropFB : [];
    return [...crops, ...cleaning, ...color];
  }, [platform]);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    // ryd valg + AI-preview ved platformskift
    setSelectedPhotoIds(new Set());
    setEditedPreview('');
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
    } finally { setLoadingSug(false); }
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

  // Foto (lokal upload)
  function onPickLocalPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
    setEditedPreview('');
    setViewMode('original');
  }

  // Brug i opslag (venstre kolonne)
  function useOriginalInPost() {
    if (!photoPreview) return;
    setQuickImageUrl(photoPreview);
    scrollToQuick();
  }
  function useAIInPost() {
    if (!editedPreview) return;
    setQuickImageUrl(editedPreview);
    scrollToQuick();
  }
  function scrollToQuick() {
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // "Anvend valgte ændringer" (mock: returnerer samme billede som AI-preview)
  async function applyPhotoEdits() {
    if (!photoPreview) return;
    setApplyBusy(true);
    // TODO: skift til rigtig API (fx /api/media/edit) når klar.
    setTimeout(() => {
      setEditedPreview(photoPreview);
      setViewMode('ai');
      setApplyBusy(false);
    }, 600);
  }

  function resetPhotoEdits() {
    setSelectedPhotoIds(new Set());
    setEditedPreview('');
    setViewMode('original');
  }

  // --- Analyse-prosa (simpel, kan senere komme fra backend) ---
  const analysisProse = useMemo(() => {
    if (!photoPreview) return '';
    if (platform === 'instagram')
      return 'Billedet har godt lys og skarphed. Et 4:5-crop kan give mere plads i feedet. Overvej en varm café-tone for en indbydende stemning.';
    if (platform === 'facebook')
      return 'Billedet er solidt til Facebook. Vælg enten 4:5 (mobil) eller 1.91:1 (bredt). Overvej at fjerne små distraktioner og give farverne et let løft.';
    return 'Billedet ser lovende ud. Et tættere crop omkring hovedmotiv og en mild farvejustering kan øge opmærksomheden i feedet.';
  }, [platform, photoPreview]);

  // --- Tæller / progress (maks 1 crop + max 3 cleaning + 1 color = 5) ---
  const cropSelected = Array.from(selectedPhotoIds).some(id => id.startsWith('crop:')) ? 1 : 0;
  const colorSelected = Array.from(selectedPhotoIds).some(id => id.startsWith('color:')) ? 1 : 0;
  const cleaningSelected = Array.from(selectedPhotoIds).filter(id => id.startsWith('clean:')).length;
  const selectedCount = cropSelected + cleaningSelected + colorSelected;
  const totalPossible = (platform ? 1 : 0) + 3 + 1; // crop(1 hvis platform valgt) + cleaning(3) + color(1)
  const pct = totalPossible ? Math.round((selectedCount / totalPossible) * 100) : 0;

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

      {/* TO-KOLONNE LAYOUT: Hurtigt opslag (venstre) + Foto & video (højre) */}
      <div
        style={{
          display:'grid', gap:12,
          gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))',
          alignItems:'start'
        }}
      >
        {/* A) Hurtigt opslag — høj, rolig kasse */}
        <Card
          title={`Hurtigt opslag ${platform ? `(${platform === 'facebook' ? 'Facebook' : 'Instagram'})` : ''}`}
          id="quick-post"
          style={{ minHeight: 620 }}
        >
          <div style={{ display:'grid', gap: 8 }}>
            <label style={label}>Titel (valgfri)</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} />
            <label style={label}>Tekst</label>
            <textarea
              rows={8}
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

            {/* Billede knyttet til opslaget (valgbar original/AI) */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#666' }}>Brug billede:</span>
              <button type="button" onClick={useOriginalInPost} disabled={!photoPreview} style={btn}>
                Original
              </button>
              <button type="button" onClick={useAIInPost} disabled={!editedPreview} style={btn}>
                AI-redigeret
              </button>
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
        </Card>

        {/* B) Foto & video — billede altid synligt, forslag scroller nedenunder, sticky footer */}
        <Card title="Foto & video" style={{ minHeight: 620 }}>
          {!photoPreview ? (
            <div
              style={{
                border:'2px dashed #ddd', borderRadius:12, padding:20,
                minHeight:200, display:'grid', placeItems:'center'
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
            // Indre layout: [Billede (fast)] + [Scroller] + [Sticky footer]
            <div style={{ display:'grid', gridTemplateRows:'auto 1fr auto', gap:10, height:'100%' }}>
              {/* Billede + visningstoggle + upload/erstat */}
              <div>
                {/* Toggle Original/AI (vises kun hvis der findes AI-preview) */}
                <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button
                      type="button"
                      onClick={()=>setViewMode('original')}
                      disabled={viewMode==='original'}
                      style={{ ...btn, background: viewMode==='original' ? '#111' : '#fafafa', color: viewMode==='original' ? '#fff' : '#111', borderColor: viewMode==='original' ? '#111' : '#ddd' }}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={()=>setViewMode('ai')}
                      disabled={!editedPreview || viewMode==='ai'}
                      style={{ ...btn, background: viewMode==='ai' ? '#111' : '#fafafa', color: viewMode==='ai' ? '#fff' : '#111', borderColor: viewMode==='ai' ? '#111' : '#ddd' }}
                    >
                      AI-redigeret
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
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
                    <button type="button" onClick={()=>{ setPhotoPreview(''); setEditedPreview(''); setViewMode('original'); }} style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
                      Fjern
                    </button>
                  </div>
                </div>

                <img
                  src={viewMode==='ai' && editedPreview ? editedPreview : photoPreview}
                  alt={viewMode==='ai' ? 'AI-redigeret' : 'Original'}
                  style={{ width:'100%', maxHeight:260, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }}
                />
              </div>

              {/* Scroller: prosa + forslag */}
              <div style={{ overflowY:'auto', paddingRight:4 }}>
                {analysisProse && (
                  <div style={{ marginBottom:10, padding:10, border:'1px solid #eee', borderRadius:8, background:'#fafafa', fontSize:13 }}>
                    {analysisProse}
                  </div>
                )}
                <PhotoSuggestions
                  items={photoItems}
                  selected={selectedPhotoIds}
                  onToggle={togglePhotoSuggestion}
                />
                {/* ekstra bundmargen så man ikke scroller ind under footeren */}
                <div style={{ height: 12 }} />
              </div>

              {/* Sticky footer (ikke i scroll) — tæller + progress + handlinger */}
              <div style={{ borderTop:'1px solid #eee', paddingTop:10 }}>
                {/* Progress */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ flex:1, height:8, background:'#f2f2f2', borderRadius:999, overflow:'hidden' }}>
                    <div style={{ width: `${pct}%`, height:'100%', background:'#111' }} />
                  </div>
                  <div style={{ fontSize:12, color:'#444', minWidth: 90, textAlign:'right' }}>
                    {selectedCount}/{totalPossible} valgt
                  </div>
                </div>

                {/* Knapper */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button type="button" onClick={applyPhotoEdits} disabled={!photoPreview || selectedPhotoIds.size===0 || applyBusy} style={btn}>
                    {applyBusy ? 'Anvender…' : 'Anvend valgte ændringer'}
                  </button>
                  <button type="button" onClick={resetPhotoEdits} style={{ ...btn, background:'#fafafa', color:'#111', borderColor:'#ddd' }}>
                    Nulstil
                  </button>
                  <div style={{ flex:1 }} />
                  <button type="button" onClick={useOriginalInPost} disabled={!photoPreview} style={btn}>
                    Brug <span style={{ fontWeight:600, marginLeft:4 }}>Original</span> i opslag
                  </button>
                  <button type="button" onClick={useAIInPost} disabled={!editedPreview} style={btn}>
                    Brug <span style={{ fontWeight:600, marginLeft:4 }}>AI-redigeret</span> i opslag
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
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
