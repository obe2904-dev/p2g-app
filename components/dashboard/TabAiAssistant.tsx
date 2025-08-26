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

  // Små “meta-chips” over kortene (kun UI – teksten kommer fra backend)
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

  // Første load – vis tomme kort indtil platform vælges
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

      // Valgfri lokal løft af AI-tæller (HeroRow kan lytte via prop)
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
        body: JSON.stringify({ title, body, image_url: '' })
      });
      if (!r.ok) { setStatusMsg('Fejl: ' + (await r.text())); return; }

      setStatusMsg('Gemt som udkast ✔');
      setTitle('');
      setBody('');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
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

          {/* Små tips pr. platform */}
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
