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

  // --- AI forslag sektion ---
  const [facebookOn, setFacebookOn] = useState(true);
  const [instagramOn, setInstagramOn] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  // “Hurtigt opslag” – fyldes når man klikker på et forslag
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function fetchSuggestions() {
    setSuggestMsg(null);
    setSuggestLoading(true);
    try {
      const selectedChannels = [
        facebookOn ? 'Facebook' : null,
        instagramOn ? 'Instagram' : null,
      ].filter(Boolean) as string[];

      if (selectedChannels.length === 0) {
        setSuggestMsg('Vælg mindst én kanal (Facebook/Instagram).');
        setSuggestions([]);
        return;
      }

      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        setSuggestMsg('Ikke logget ind.');
        return;
      }

      // Lille trick: vi putter kanaler ind i "topic", så din eksisterende /api/ai/suggest
      // kan formatere teksten derefter – uden at ændre API’et nu.
      const topic = `Kanal: ${selectedChannels.join(', ')}. Lav 3 korte varianter der passer til kanalerne.`;

      const resp = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          topic,
          tone: 'neutral/venlig',
          post_body: '' // ingen base-tekst – rene idéforslag
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        setSuggestMsg('Fejl: ' + t);
        setSuggestions([]);
        return;
      }

      const json = await resp.json();
      const arr: string[] = Array.isArray(json?.suggestions) ? json.suggestions.slice(0,3) : [];
      setSuggestions(arr);

      // Optimistisk opdatering af tæller (API logger i forvejen i ai_usage)
      setCounts(c => ({ ...c, aiTextThisMonth: (c.aiTextThisMonth ?? 0) + 1 }));
    } catch (e:any) {
      setSuggestMsg('Fejl: ' + e.message);
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }

  function useSuggestion(s: string) {
    // Læg forslaget direkte ned i “Hurtigt opslag”
    setQuickBody(s);
    setSaveMsg('Forslag indsat – ret og gem som udkast.');
  }

  async function saveQuickDraft(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    if (!quickBody.trim()) {
      setSaveMsg('Skriv eller indsæt en tekst før du gemmer.');
      return;
    }
    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setSaveMsg('Ikke logget ind.'); return; }

      const resp = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: quickTitle || null, body: quickBody, image_url: null })
      });

      if (!resp.ok) {
        const t = await resp.text();
        setSaveMsg('Fejl: ' + t);
        return;
      }

      setQuickTitle('');
      setQuickBody('');
      setSaveMsg('Udkast gemt ✔ Find det under “Opslag”.');
    } catch (e:any) {
      setSaveMsg('Fejl: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* TOP: 2 små kort + 1 dobbelt (placeholder) i én række */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '1fr 1fr 2fr',
          alignItems: 'stretch',
        }}
      >
        {/* Kort 1: Opslag denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
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

        {/* Kort 3: Dobbelt bredde (pladsholder til fx “Virksomhedsprofil”-overblik) */}
        <div style={{ ...cardStyle, minHeight: 120, display:'flex', alignItems:'center', justifyContent:'center', color:'#777' }}>
          {/* Tomt nu – kan vise “Café med take-away • FB ✓ IG ✓ • Se virksomhedsprofil” */}
          (Plads til Virksomhedsprofil – kommer)
        </div>
      </section>

      {/* FANER – vi beholder kun AI-fanen i denne fil (de andre er “tomt” for nu) */}
      <section style={{ display:'flex', gap:8, marginTop: 4 }}>
        <button style={tabActiveStyle}>AI Assistent</button>
        <button style={tabStyle} disabled>Planlæg & publicér</button>
        <button style={tabStyle} disabled>Performance</button>
      </section>

      {/* AI Assistent – Sektion A: 3 forslag i en række + kanaler + “Få 3 nye” */}
      <section style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: 10, flexWrap:'wrap' }}>
          <div style={{ fontWeight: 600 }}>AI forslag</div>
          <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap:12 }}>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <input type="checkbox" checked={facebookOn} onChange={e=>setFacebookOn(e.target.checked)} />
              <span>Facebook</span>
            </label>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <input type="checkbox" checked={instagramOn} onChange={e=>setInstagramOn(e.target.checked)} />
              <span>Instagram</span>
            </label>

            <button onClick={fetchSuggestions} disabled={suggestLoading}>
              {suggestLoading ? 'Henter…' : 'Få 3 nye'}
            </button>
          </div>
        </div>

        {/* Forslags-grid */}
        <div style={{
          display:'grid',
          gap:12,
          gridTemplateColumns:'repeat(3, minmax(180px, 1fr))'
        }}>
          {[0,1,2].map(i => {
            const s = suggestions[i];
            return (
              <div key={i} style={{ border:'1px solid #eee', borderRadius:10, padding:12, background:'#fff' }}>
                {s ? (
                  <>
                    <div style={{ whiteSpace:'pre-wrap', minHeight: 72 }}>{s}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                      <button onClick={()=>useSuggestion(s)}>Brug forslag</button>
                      <button onClick={()=>navigator.clipboard.writeText(s)}>Kopiér</button>
                    </div>
                  </>
                ) : (
                  <div style={{ color:'#777' }}>
                    {i === 0 && !suggestLoading ? 'Klik “Få 3 nye”' : '—'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {suggestMsg && <p style={{ marginTop: 8, color:'#b00' }}>{suggestMsg}</p>}
      </section>

      {/* AI Assistent – Sektion B: Hurtigt opslag (editor) */}
      <section style={cardStyle}>
        <div style={{ fontWeight:600, marginBottom:8 }}>Hurtigt opslag</div>
        <form onSubmit={saveQuickDraft} style={{ display:'grid', gap:8, maxWidth: 720 }}>
          <label>Titel (valgfri)</label>
          <input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} />

          <label>Tekst</label>
          <textarea rows={6} value={quickBody} onChange={e=>setQuickBody(e.target.value)} placeholder="Indsæt et AI-forslag her eller skriv selv…" />

          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button type="submit" disabled={saving}>{saving ? 'Gemmer…' : 'Gem som udkast'}</button>
            <button type="button" onClick={()=>navigator.clipboard.writeText((quickTitle?quickTitle+'\n':'')+quickBody)}>
              Kopiér tekst
            </button>
            <a href="/posts">Gå til “Opslag”</a>
          </div>

          {saveMsg && <p style={{ marginTop:6 }}>{saveMsg}</p>}
        </form>
      </section>
    </div>
  );
}

/* --- Stilarter (simple inline styles for nu) --- */

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

const tabStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #eee',
  borderRadius: 999,
  background: '#fafafa',
  fontSize: 13,
  cursor: 'not-allowed'
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  cursor: 'default',
  background: '#fff',
  borderColor: '#ddd',
  fontWeight: 600
};
