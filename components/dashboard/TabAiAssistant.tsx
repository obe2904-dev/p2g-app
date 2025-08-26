'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Card from './Card';

type TabAiAssistantProps = {
  onAiTextUse?: () => void; // kaldes når vi henter nye forslag (lokal tæller bump)
};

export default function TabAiAssistant({ onAiTextUse }: TabAiAssistantProps) {
  // Kanaler for forslag
  const [sugChanFB, setSugChanFB] = useState(true);
  const [sugChanIG, setSugChanIG] = useState(true);

  // AI-forslag
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);

  // Hurtigt opslag
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] =
    useState<'neutral' | 'tilbud' | 'informativ' | 'hyggelig'>('neutral');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          topic: 'Idéer til opslag for en lokal virksomhed.' + channelHint,
          tone: 'neutral',
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const arr = Array.isArray(data.suggestions)
        ? data.suggestions.slice(0, 3)
        : [];
      setSuggestions(arr);

      // Lokal tæller (backend logger stadig i ai_usage)
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
      if (!body.trim()) {
        setStatusMsg('Skriv eller vælg først noget tekst.');
        return;
      }
      setStatusMsg('Forbedrer tekst…');
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        setStatusMsg('Ikke logget ind.');
        return;
      }

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ post_body: body, tone }),
      });
      if (!r.ok) {
        setStatusMsg('AI-fejl: ' + (await r.text()));
        return;
      }
      const data = await r.json();
      const first =
        Array.isArray(data.suggestions) && data.suggestions[0]
          ? String(data.suggestions[0])
          : '';
      if (first) {
        setBody(first);
        setStatusMsg('Opdateret med AI ✔');
      } else {
        setStatusMsg('AI gav ikke et brugbart svar. Prøv igen.');
      }
    } catch (e: any) {
      setStatusMsg('Fejl: ' + e.message);
    }
  }

  async function saveDraft() {
    setStatusMsg('Gemmer…');
    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        setStatusMsg('Ikke logget ind.');
        return;
      }
      const r = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ title, body }),
      });
      if (!r.ok) {
        setStatusMsg('Fejl: ' + (await r.text()));
        return;
      }
      setStatusMsg('Gemt som udkast ✔');
      setBody('');
    } catch (e: any) {
      setStatusMsg('Fejl: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      {/* AI-forslag (3 kort) + “Få 3 nye” + kanaler */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 12, flex: '1 1 auto', minWidth: 260 }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={{ flex: '1 1 0', minWidth: 260 }}>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, minHeight: 84 }}>
                {loadingSug ? 'Henter…' : suggestions[i] || '—'}
              </div>
              <div style={{ marginTop: 8 }}>
                <button
                  disabled={!suggestions[i]}
                  onClick={() => suggestions[i] && pickSuggestion(suggestions[i] as string)}
                  style={{ width: '100%' }}
                >
                  Brug dette
                </button>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={refreshSuggestions} disabled={loadingSug}>
              {loadingSug ? 'Henter…' : 'Få 3 nye'}
            </button>
            <label style={{ fontSize: 12, color: '#555' }}>
              <input
                type="checkbox"
                checked={sugChanFB}
                onChange={(e) => setSugChanFB(e.target.checked)}
              />{' '}
              Facebook
            </label>
            <label style={{ fontSize: 12, color: '#555' }}>
              <input
                type="checkbox"
                checked={sugChanIG}
                onChange={(e) => setSugChanIG(e.target.checked)}
              />{' '}
              Instagram
            </label>
          </div>
          {sugErr && <div style={{ color: '#b00' }}>{sugErr}</div>}
        </div>
      </div>

      {/* 2-kolonne layout: Hurtigt opslag (venstre) + Foto-placeholder (højre) */}
      <div className="ai-two-col">
        {/* Hurtigt opslag (med ramme via Card) */}
        <Card title="Hurtigt opslag" id="quick-post">
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            <label style={label}>Titel (valgfri)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />

            <label style={label}>Tekst</label>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Sæt et AI-forslag ind eller skriv selv…"
            />

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Tone:</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as any)}>
                <option value="neutral">Neutral/Venlig</option>
                <option value="tilbud">Tilbud</option>
                <option value="informativ">Informativ</option>
                <option value="hyggelig">Hyggelig</option>
              </select>

              <button type="button" onClick={improveWithAI}>
                Forbedr med AI
              </button>
              <button type="button" onClick={saveDraft} disabled={saving}>
                {saving ? 'Gemmer…' : 'Gem som udkast'}
              </button>
              <Link href="/posts" style={pillLink}>
                Gå til dine opslag →
              </Link>
            </div>

            {statusMsg && (
              <p style={{ color: statusMsg.startsWith('Fejl') ? '#b00' : '#222' }}>{statusMsg}</p>
            )}
          </div>
        </Card>

        {/* Foto & video — pladsholder (kommer i næste step) */}
        <Card title="Foto & video (kommer snart)">
          <p style={{ color: '#555', marginBottom: 8 }}>
            Her kan du snart uploade billeder, få AI-feedback (lys, format, komposition) og sende
            billedet direkte ned i “Hurtigt opslag”.
          </p>
          <ul style={{ paddingLeft: 18, margin: '8px 0', color: '#555' }}>
            <li>Upload/drag-and-drop</li>
            <li>Crop-presets: Instagram 1:1 / 4:5, Facebook 4:5 / 1.91:1</li>
            <li>“Brug i opslag” med ét klik</li>
          </ul>
          <button disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            Upload billede (deaktiveret)
          </button>
        </Card>
      </div>

      <style jsx>{`
        .ai-two-col {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr; /* mobil */
        }
        @media (min-width: 980px) {
          .ai-two-col {
            grid-template-columns: 1fr 1fr; /* desktop: 2 kolonner */
          }
        }
      `}</style>
    </section>
  );
}

const label: React.CSSProperties = { fontSize: 12, color: '#666' };

const pillLink: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  border: '1px solid #ddd',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#fafafa',
  textDecoration: 'none',
  color: 'inherit',
};
