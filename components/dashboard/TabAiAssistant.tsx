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

  // -------- Foto & video (beta) --------
  const [imageUrl, setImageUrl] = useState<string>('');     // upload preview/valg
  const [quickImageUrl, setQuickImageUrl] = useState('');   // følger “Hurtigt opslag”
  const [uploadBusy, setUploadBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(null);

  // Meta chips over forslag (UI-only)
  const metas: Record<'facebook' | 'instagram', SuggestionMeta[]> = useMemo(() => ({
    facebook: [
      { type: 'Community',    engagement: 'Høj',   bestTime: 'kl. 13:00' },
      { type: 'Spørgsmål',    engagement: 'Mellem',bestTime: 'kl. 15:00' },
      { type: 'Lærings-tip',  engagement: 'Høj',   bestTime: 'kl. 11:00' },
    ],
    instagram: [
      { type: 'Visuel story', engagement: 'Høj',   bestTime: 'kl. 14:00' },
      { type: 'Lifestyle',    engagement: 'Høj',   bestTime: 'kl. 08:00' },
      { type: 'Trending',     engagement: 'Mellem',bestTime: 'kl. 18:00' },
    ],
  }), []);

  // Platform skift → nulstil visning af forslag
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

      // Lokal tæller (HeroRow kan lytte via prop)
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
      // bevar evt. quickImageUrl hvis man vil genbruge samme billede
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  // ---------- Foto: upload ----------
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
      setStatusMsg('Billede uploadet ✔');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setUploadBusy(false); }
  }

  // ---------- Foto: analyse ----------
  async function analyzePhoto() {
    if (!imageUrl) { setStatusMsg('Upload et billede først.'); return; }
    setAnalyzing(true); setAnalysis(null); setStatusMsg(null);
    try {
      const channels = platform ? [platform] : [];
      const resp = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, channels })
      });
      if (!resp.ok) setStatusMsg('Analyse-fejl: ' + (await resp.text()));
      else setAnalysis(await resp.json());
    } catch (e:any) { setStatusMsg('Analyse-fejl: ' + e.message); }
    finally { setAnalyzing(false); }
  }

  function useInQuickPost() {
    if (!imageUrl) return;
    setQuickImageUrl(imageUrl);
    scrollToQuick();
  }

  // UI helpers
  const chip = (text: string) => (
    <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #eee', borderRadius: 999, background:'#fafafa' }}>
      {text}
    </span>
  );

  function scrollToQuick() {
    const el = document.getElementById('quick-post');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

      {/* AI-forslag */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flex: '1 1 auto', minWidth: 260 }}>
          {[0,1,2].map((i) => {
            const meta = platform ? metas[platform as 'facebook'|'instagram'][i] : null;
            return (
              <Card
                key={i}
                title={platform ? `AI-forslag (${meta?.type || '—'})` : 'AI-forslag'}
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

        <Card title="Handling" style={{ alignSelf:'stretch', width: 220 }}>
          <div style={{ display:'grid', gap:8 }}>
            <button
              onClick={refreshSuggestions}
              disabled={loadingSug || !platform}
              style={{
                padding:'10px 12px', border:'1px solid #111',
                background: !platform ? '#f2f2f2' : '#111',
                color: !platform ? '#999' : '#fff',
                borderRadius:8, cursor: !platform ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingSug ? 'Henter…' : 'Få 3 nye'}
            </button>
            {sugErr && <div style={{ color:'#b00', fontSize:13 }}>{sugErr}</div>}
            {!platform && <div style={{ fontSize:12, color:'#666' }}>Vælg først en platform.</div>}
          </div>
        </Card>
      </div>

      {/* Hurtigt opslag */}
      <Card title={`Hurtigt opslag ${platform ? `(${platform === 'facebook' ? 'Facebook' : 'Instagram'})` : ''}`} id="quick-post">
        <div style={{ display:'grid', gap: 8, maxWidth: 720 }}>
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

          {/* Billede preview der følger opslaget */}
          {quickImageUrl && (
            <div style={{ marginTop: 8 }}>
              <img
                src={quickImageUrl}
                alt="Valgt billede"
                style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #eee' }}
              />
            </div>
          )}
        </div>

        {statusMsg && <p style={{ marginTop: 8, color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>{statusMsg}</p>}
      </Card>

      {/* Foto & video (beta) */}
      <Card title="Foto & video (beta)">
        {/* Upload-zone (halv-bredde følelse) */}
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
            marginBottom: 10
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

        {/* Kontroller */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: 10 }}>
          <button type="button" onClick={analyzePhoto} disabled={!imageUrl || analyzing} style={btn}>
            {analyzing ? 'Analyserer…' : 'Analyser billede'}
          </button>
          {imageUrl && (
            <button type="button" onClick={useInQuickPost} style={btn}>
              Brug i opslag
            </button>
          )}
          {quickImageUrl && <span style={{ fontSize:12, color:'#666' }}>Billedet er tilknyttet “Hurtigt opslag”.</span>}
        </div>

        {/* Preview */}
        {imageUrl && (
          <div style={{ marginTop: 6 }}>
            <img src={imageUrl} alt="Upload" style={{ maxWidth: '100%', borderRadius: 8, border:'1px solid #eee' }} />
          </div>
        )}

        {/* Feedback */}
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
      </Card>
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
