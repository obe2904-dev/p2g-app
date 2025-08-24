// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

type Suggestion = { id: string; label: string; priority: 'Høj' | 'Medium' | 'Lav'; text: string; bestTime?: string };

type Tab = 'ai' | 'schedule' | 'performance';

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('ai');

  // AI-forslag
  const [ideas, setIdeas] = useState<Suggestion[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideasMsg, setIdeasMsg] = useState<string | null>(null);

  // Hurtigt opslag
  const [quickBody, setQuickBody] = useState('');
  const [quickTone, setQuickTone] = useState<'neutral'|'tilbud'|'hyggelig'|'informativ'>('neutral');
  const [quickOut, setQuickOut] = useState<string | null>(null);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);

  // Session/email til API-kald
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const { data: u } = await supabase.auth.getUser();
        const mail = u.user?.email;
        if (!mail) { setErr('Ikke logget ind.'); return; }
        setEmail(mail);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Opslag denne måned (kun publicerede)
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', mail)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // Opslag i alt (kun publicerede)
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', mail)
          .eq('status', 'published');

        // AI-forbrug – tekst
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', mail)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI-forbrug – foto
        const { count: aiPhotoThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', mail)
          .eq('kind', 'photo')
          .gte('used_at', startISO);

        setCounts({
          totalPosts: totalPosts ?? 0,
          postsThisMonth: postsThisMonth ?? 0,
          aiTextThisMonth: aiTextThisMonth ?? 0,
          aiPhotoThisMonth: aiPhotoThisMonth ?? 0,
        });
      } catch (e:any) {
        setErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoadingCounts(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  // Hent AI-forslag (idebank) – 3 ad gangen
  async function loadIdeas() {
    try {
      setIdeasMsg(null);
      setLoadingIdeas(true);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setIdeasMsg('Ikke logget ind.'); return; }

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic: 'idebank', tone: 'neutral', post_body: '' })
      });
      if (!r.ok) {
        setIdeasMsg('AI-fejl: ' + (await r.text()));
        return;
      }
      const data = await r.json();
      const arr: string[] = Array.isArray(data?.suggestions) ? data.suggestions.slice(0,3) : [];
      // Lidt pynt: kategorier + “bedste tidspunkt” placeholders
      const cats: Array<{label:string;prio:'Høj'|'Medium'|'Lav';best:string}> = [
        { label: 'Trending emne', prio: 'Høj',   best: 'kl. 10:30' },
        { label: 'Spørg følgerne', prio: 'Medium', best: 'kl. 18:00' },
        { label: 'Bag kulisserne', prio: 'Høj',   best: 'kl. 14:00' },
      ];
      const mapped: Suggestion[] = (arr.length ? arr : [
        'Tip: Del dagens fristelser og spørg “Hvad skal vi kalde den nye kage?” 🍰',
        'Spørgsmål: “Hvilken kaffe drikker du i dag?” ☕️ #kaffetid',
        'Vis personalets favorit – og hvorfor 🔥',
      ]).map((t, i) => ({
        id: String(i+1),
        label: cats[i % cats.length].label,
        priority: cats[i % cats.length].prio,
        text: String(t),
        bestTime: cats[i % cats.length].best,
      }));
      setIdeas(mapped);
    } catch (e:any) {
      setIdeasMsg('Kunne ikke hente idéer: ' + e.message);
    } finally {
      setLoadingIdeas(false);
    }
  }

  useEffect(() => { loadIdeas(); }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(()=>{});
  }

  async function quickGenerate() {
    try {
      setQuickMsg(null);
      setQuickBusy(true);
      setQuickOut(null);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setQuickMsg('Ikke logget ind.'); return; }

      const r = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ post_body: quickBody, tone: quickTone })
      });
      if (!r.ok) { setQuickMsg('AI-fejl: ' + (await r.text())); return; }
      const data = await r.json();
      const out = Array.isArray(data?.suggestions) ? data.suggestions[0] : null;
      setQuickOut(out || 'Kunne ikke generere et forslag lige nu.');
    } catch (e:any) {
      setQuickMsg('Fejl: ' + e.message);
    } finally {
      setQuickBusy(false);
    }
  }

  const headerRow = useMemo(() => (
    <section style={rowGrid}>
      {/* Kort 1: Opslag denne måned */}
      <div style={card}>
        <div style={cardTitle}>Opslag denne måned</div>
        <div style={bigNumber}>{loadingCounts ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}</div>
        <div style={subText}>I alt: <strong>{loadingCounts ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong></div>
      </div>

      {/* Kort 2: AI denne måned */}
      <div style={card}>
        <div style={cardTitle}>AI denne måned</div>
        <div style={bigNumber}>{loadingCounts ? '—' : aiTotal.toLocaleString('da-DK')}</div>
        <div style={subText}>
          Tekst: <strong>{loadingCounts ? '—' : counts.aiTextThisMonth}</strong> · Foto: <strong>{loadingCounts ? '—' : counts.aiPhotoThisMonth}</strong>
        </div>
      </div>

      {/* Kort 3: Virksomhedsprofil (placeholder) */}
      <div style={{ ...card, minHeight: 120 }}>
        <div style={cardTitle}>Virksomhedsprofil</div>
        <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
          <li>Branche: <strong>Café</strong> (kan ændres)</li>
          <li>Kanaler: <span>Facebook ✅</span> · <span>Instagram ✅</span></li>
          <li>Adresse/By: <span>-</span></li>
          <li>Web: <a href="/" onClick={e=>e.preventDefault()}>—</a></li>
        </ul>
        <div style={{ marginTop: 8 }}>
          <a href="/profile" style={linkButton}>Se profil</a>
        </div>
      </div>
    </section>
  ), [counts, loadingCounts, aiTotal]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* HERO-kort */}
      {headerRow}

      {/* Faner */}
      <nav style={tabsBar}>
        <button
          onClick={()=>setActiveTab('ai')}
          aria-pressed={activeTab==='ai'}
          style={{ ...tabBtn, ...(activeTab==='ai' ? tabBtnActive : {}) }}
        >AI-assistent</button>
        <button
          onClick={()=>setActiveTab('schedule')}
          aria-pressed={activeTab==='schedule'}
          style={{ ...tabBtn, ...(activeTab==='schedule' ? tabBtnActive : {}) }}
        >Planlægning & udgivelse</button>
        <button
          onClick={()=>setActiveTab('performance')}
          aria-pressed={activeTab==='performance'}
          style={{ ...tabBtn, ...(activeTab==='performance' ? tabBtnActive : {}) }}
        >Performance</button>
      </nav>

      {/* Indhold for faner */}
      {activeTab === 'ai' && (
        <>
          {/* AI Content – idebank */}
          <section style={panel}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <h3 style={{ margin:0, fontSize:16 }}>AI-forslag (idebank)</h3>
              <span style={{ fontSize:12, color:'#666' }}>Personlige idéer baseret på din profil</span>
              <div style={{ marginLeft:'auto' }}>
                <button onClick={loadIdeas} disabled={loadingIdeas} style={ghostBtn}>
                  {loadingIdeas ? 'Henter…' : 'Få nye forslag'}
                </button>
              </div>
            </div>

            {ideasMsg && <p style={{ color:'#b00', marginTop: 0 }}>{ideasMsg}</p>}

            <div style={ideasGrid}>
              {ideas.map(idea => (
                <article key={idea.id} style={ideaCard}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={chip}>{idea.label}</span>
                    <span style={{ fontSize:12, color:'#666' }}>{idea.priority}</span>
                    {idea.bestTime && <span style={{ fontSize:12, color:'#666', marginLeft:'auto' }}>Bedst: {idea.bestTime}</span>}
                  </div>
                  <p style={{ margin:'0 0 8px 0' }}>{idea.text}</p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={()=>copy(idea.text)} style={primaryBtn}>Kopiér idé</button>
                    <a href="/posts/new" style={ghostLink}>Brug i “Nyt opslag”</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Hurtige værktøjer: a) Hurtigt opslag  b) Foto-hjælp */}
          <section style={twoCols}>
            {/* A) Hurtigt opslag */}
            <div style={panel}>
              <h3 style={{ marginTop:0, fontSize:16 }}>Hurtigt opslag</h3>
              <label style={lbl}>Din tekst eller stikord</label>
              <textarea
                rows={4}
                value={quickBody}
                onChange={e=>setQuickBody(e.target.value)}
                placeholder="Skriv stikord (fx “fredagstilbud – latte + croissant 49 kr.”)…"
                style={ta}
              />
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label style={{ fontSize:13 }}>Tone:</label>
                <select value={quickTone} onChange={e=>setQuickTone(e.target.value as any)}>
                  <option value="neutral">Neutral/venlig</option>
                  <option value="tilbud">Tilbud</option>
                  <option value="hyggelig">Hyggelig</option>
                  <option value="informativ">Informativ</option>
                </select>
                <button onClick={quickGenerate} disabled={quickBusy || !quickBody.trim()} style={primaryBtn}>
                  {quickBusy ? 'Genererer…' : 'Generér med AI'}
                </button>
                <a href="/posts/new" style={ghostLink}>Åbn “Nyt opslag”</a>
              </div>
              {quickMsg && <p style={{ color:'#b00', marginTop:8 }}>{quickMsg}</p>}
              {quickOut && (
                <div style={{ marginTop:10, padding:10, border:'1px dashed #ddd', borderRadius:8 }}>
                  <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>AI-forslag</div>
                  <p style={{ margin:0 }}>{quickOut}</p>
                  <div style={{ marginTop:8 }}>
                    <button onClick={()=>copy(quickOut)} style={ghostBtn}>Kopiér</button>
                  </div>
                </div>
              )}
            </div>

            {/* B) Foto-hjælp (placeholder) */}
            <div style={panel}>
              <h3 style={{ marginTop:0, fontSize:16 }}>Foto-hjælp</h3>
              <p style={{ marginTop:0, color:'#555' }}>
                Upload et billede på siden <a href="/posts/new">Nyt opslag</a> for at få lys/format-feedback.
              </p>
              <ul style={{ margin:0, paddingLeft:18, lineHeight:1.6 }}>
                <li>Tip: Brug 1080×1350 til Instagram feed</li>
                <li>Naturligt lys → vend motivet mod vinduet</li>
                <li>Hold motivet i midten – undgå at beskære produktet</li>
              </ul>
            </div>
          </section>
        </>
      )}

      {activeTab === 'schedule' && (
        <section style={panel}>
          <h3 style={{ marginTop:0, fontSize:16 }}>Planlægning & udgivelse</h3>
          <p style={{ color:'#555', marginTop:0 }}>
            Kalender og planlægning kommer her (placeholder). Gå evt. til <a href="/posts">Dine opslag</a>.
          </p>
        </section>
      )}

      {activeTab === 'performance' && (
        <section style={panel}>
          <h3 style={{ marginTop:0, fontSize:16 }}>Performance</h3>
          <p style={{ color:'#555', marginTop:0 }}>
            Et simpelt overblik over reach/likes og bedste tidspunkter kommer her (placeholder).
          </p>
        </section>
      )}

      {err && <p style={{ color: '#b00' }}>{err}</p>}
    </div>
  );
}

/* ====== styles (inline objects) ====== */

const rowGrid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: '1fr 1fr 2fr', // to små + én dobbelt
  alignItems: 'stretch',
};

const card: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  minWidth: 220,
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

const tabsBar: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 8,
  background: '#f3f3f5',
  borderRadius: 999,
  padding: 4,
};

const tabBtn: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
};

const tabBtnActive: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd',
};

const panel: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

const ideasGrid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

const ideaCard: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 12,
  background: '#fff',
  minHeight: 120,
};

const chip: React.CSSProperties = {
  fontSize: 12,
  border: '1px solid #ddd',
  padding: '2px 8px',
  borderRadius: 999,
  background: '#fafafa',
};

const twoCols: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: '1fr 1fr',
};

const lbl: React.CSSProperties = { fontSize: 12, color:'#666', marginBottom: 4, display:'block' };
const ta: React.CSSProperties = { width:'100%', padding:8, border:'1px solid #ddd', borderRadius:8, resize:'vertical' };

const primaryBtn: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #222',
  background: '#111',
  color: '#fff',
  borderRadius: 8,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 8,
  cursor: 'pointer',
};

const linkButton: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ddd',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'inherit',
  background: '#fff',
};

const ghostLink: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'inherit',
  background: '#fff',
};
