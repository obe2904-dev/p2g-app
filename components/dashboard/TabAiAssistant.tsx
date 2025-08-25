'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from './Card';
import { supabase } from '@/lib/supabaseClient';

export default function TabAiAssistant({
  onAiTextBump,
}: {
  onAiTextBump?: () => void;
}) {
  // Forslag
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);
  const [sugChanFB, setSugChanFB] = useState(true);
  const [sugChanIG, setSugChanIG] = useState(true);

  // Hurtigt opslag
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] =
    useState<'neutral' | 'tilbud' | 'informativ' | 'hyggelig'>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => { void refreshSuggestions(); }, []);

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

      // Lokal bump af AI-tekst (backend logger stadig i ai_usage)
      onAiTextBump?.();
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
        body: JSON.stringify({ title, body }) // billede håndterer vi andetsteds
      });
      if (!r.ok) { setStatusMsg('Fejl: ' + (await r.text())); return; }

      setStatusMsg('Gemt som udkast ✔');
      setBody('');
    } catch (e:any) { setStatusMsg('Fejl: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      {/* Forslag-rækken */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flex: '1 1 auto', minWidth: 260 }}>
          {[0, 1, 2].map(i => (
            <Card key={i} style={{ flex: '1 1 0', minWidth: 260 }}
                  footer={
                    <button
                      disabled={!suggestions[i]}
                      onClick={() => suggestions[i] && pickSuggestion(suggestions[i]!)}
                      style={{ width: '100%' }}
                    >
                      Brug dette
                    </button>
                  }>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                {loadingSug ? 'Henter…' : (suggestions[i] || '—')}
              </div>
            </Card>
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

      {/* Hurtigt opslag (med ramme via Card) */}
      <Card title="Hurtigt opslag">
        <div id="quick-post" style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
          <label style={labelStyle}>Titel (valgfri)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />

          <label style={labelStyle}>Tekst</label>
          <textarea rows={6} value={body} onChange={e => setBody(e.target.value)}
                    placeholder="Sæt et AI-forslag ind eller skriv selv…" />

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

          {statusMsg && (
            <p style={{ color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>
              {statusMsg}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: '#666' };
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
