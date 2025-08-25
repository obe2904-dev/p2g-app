// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // --- NYT: AI-forslag state ---
  const [topic, setTopic] = useState('');               // valgfrit ekstra input til LLM
  const [wantFB, setWantFB] = useState(true);
  const [wantIG, setWantIG] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  // Hurtigt opslag (modtager tekst ved klik på et forslag)
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody]   = useState('');
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  // -----------------------------

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErr('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // Opslag i alt (KUN publicerede)
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        // Opslag denne måned (KUN publicerede)
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // AI-forbrug – tekst
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI-forbrug – foto
        const { count: aiPhotoThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'photo')
          .gte('used_at', startISO);

        setCounts({
          totalPosts: totalPosts ?? 0,
          postsThisMonth: postsThisMonth ?? 0,
          aiTextThisMonth: aiTextThisMonth ?? 0,
          aiPhotoThisMonth: aiPhotoThisMonth ?? 0,
        });
      } catch (e: any) {
        setErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  // --- NYT: Hent 3 nye forslag ---
  async function fetchNewSuggestions() {
    try {
      setLoadingSuggest(true);
      setErr(null);

      // Sammensæt "kanal-hint" til topic (ingen ændringer i backend nødvendig)
      const chosen: string[] = [];
      if (wantFB) chosen.push('Facebook');
      if (wantIG) chosen.push('Instagram');
      const channelHint = chosen.length ? `Kanaler: ${chosen.join(', ')}` : '';
      const mergedTopic = [channelHint, topic].filter(Boolean).join(' — ');

      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setErr('Ikke logget ind.'); return; }

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          topic: mergedTopic || undefined,
          // tone/baseBody/post_id kan tilføjes senere – nu er fokus kanalerne
        })
      });

      if (!resp.ok) {
        const t = await resp.text();
        setErr('LLM-fejl: ' + t);
        return;
      }
      const json = await resp.json();
      const list: string[] = Array.isArray(json.suggestions) ? json.suggestions.slice(0, 3) : [];
      setSuggestions(list);

      // Lokal tæller +1 (backend logger selv i ai_usage)
      setCounts(prev => ({ ...prev, aiTextThisMonth: (prev.aiTextThisMonth ?? 0) + 1 }));
    } catch (e: any) {
      setErr(e.message || 'Kunne ikke hente forslag');
    } finally {
      setLoadingSuggest(false);
    }
  }

  // Klik på forslag → ned i “Hurtigt opslag”
  function takeSuggestionToQuick(text: string) {
    // enkel strategi: brug som body; titel lades tom
    setQuickBody(text);
    // scroll lidt ned så brugeren ser feltet
    setTimeout(() => {
      const el = document.getElementById('quick-post');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  // Gem “Hurtigt opslag” som udkast (samme API som /posts/new bruger)
  async function saveQuickDraft() {
    try {
      setQuickStatus('Gemmer…');
      const { data: sessionData } = await supabase.auth.getSession();
      const access_token = sessionData.session?.access_token;
      if (!access_token) { setQuickStatus('Du er ikke logget ind. Gå til /login'); return; }

      const resp = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + access_token },
        body: JSON.stringify({ title: quickTitle, body: quickBody, image_url: '' })
      });

      if (!resp.ok) {
        const t = await resp.text();
        setQuickStatus('Fejl: ' + t);
        return;
      }
      setQuickStatus('Gemt som udkast ✔');
      setQuickTitle('');
      setQuickBody('');
    } catch (e: any) {
      setQuickStatus('Fejl: ' + (e.message || 'Ukendt'));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste række – tre kolonner: 1fr, 1fr, 2fr (tredje er tomt placeholder) */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1: Opslag denne måned / I alt */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt: <strong>{loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2: AI denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loading ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Dobbelt bredde (tom placeholder) */}
        <div style={{ ...cardStyle, minHeight: 120 }}>
          {/* Plads til “Virksomhedsprofil-overblik” senere */}
        </div>
      </section>

      {/* FEJLTEKST */}
      {err && <p style={{ color: '#b00' }}>{err}</p>}

      {/* ------------------- AI ASSISTENT — Forslagsrække ------------------- */}
      <section style={{ ...cardStyle }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <strong>AI forslag</strong>
          <span style={{ marginLeft:'auto' }} />
          {/* Kanaler ved “Få 3 nye” */}
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={wantFB} onChange={e=>setWantFB(e.target.checked)} />
            Facebook
          </label>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={wantIG} onChange={e=>setWantIG(e.target.checked)} />
            Instagram
          </label>
          <button onClick={fetchNewSuggestions} disabled={loadingSuggest}>
            {loadingSuggest ? 'Henter…' : 'Få 3 nye'}
          </button>
        </div>

        {/* valgfrit ekstra felt til “emne” */}
        <div style={{ marginTop: 10 }}>
          <label style={{ display:'block', fontSize:12, color:'#666' }}>Emne (valgfrit)</label>
          <input
            value={topic}
            onChange={e=>setTopic(e.target.value)}
            placeholder="Fx “Dagens kage” eller “Fredagshygge”"
            style={{ width:'100%' }}
          />
        </div>

        {/* 3 forslag i en horisontal række */}
        <div
          style={{
            display:'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap:12,
            marginTop:12
          }}
        >
          {(suggestions.length ? suggestions : [1,2,3].map(()=>'')) .slice(0,3).map((text, i) => (
            <button
              key={i}
              type="button"
              onClick={() => text && takeSuggestionToQuick(text)}
              title={text ? 'Klik for at bruge dette forslag i Hurtigt opslag' : undefined}
              style={{
                textAlign:'left',
                border:'1px solid #eee',
                borderRadius:12,
                padding:12,
                background:'#fff',
                cursor: text ? 'pointer' : 'default',
                opacity: text ? 1 : 0.5,
                minHeight: 100
              }}
            >
              <div style={{ fontSize:12, color:'#666', marginBottom:6 }}>Forslag {i+1}</div>
              <div style={{ whiteSpace:'pre-wrap' }}>
                {text || '— (klik “Få 3 nye” for at hente forslag)'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ------------------- HURTIGT OPSLAG ------------------- */}
      <section id="quick-post" style={{ ...cardStyle }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <strong>Hurtigt opslag</strong>
          <span style={{ fontSize:12, color:'#666' }}>(Vælg et forslag ovenfor eller skriv selv)</span>
        </div>

        <div style={{ display:'grid', gap:8, maxWidth: 680 }}>
          <label>Titel (valgfri)</label>
          <input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} />

          <label>Tekst</label>
          <textarea rows={6} value={quickBody} onChange={e=>setQuickBody(e.target.value)} placeholder="Indsæt eller skriv din tekst her…" />

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
            <button type="button" onClick={saveQuickDraft} disabled={!quickBody.trim()}>
              Gem som udkast
            </button>
            <button type="button" onClick={() => { setQuickTitle(''); setQuickBody(''); }}>
              Ryd
            </button>
            <a href="/posts" style={{ textDecoration:'underline' }}>Se alle opslag</a>
          </div>

          {quickStatus && <p style={{ marginTop: 6 }}>{quickStatus}</p>}
        </div>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
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
