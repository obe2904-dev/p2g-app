'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PreviewItem = { url:string; title:string|null; snippet:string|null; ogImage?:string|null };
type PreviewOK = {
  ok: true;
  source_domain: string;
  previews: PreviewItem[];
  proposal: {
    summary_text: string;
    keywords: string[];
    hero_image_url: string | null;
    source_urls: string[];
    language: 'da';
  };
};
type PreviewErr = { ok:false; error:string };

export default function BrandPreviewTest() {
  const [website, setWebsite] = useState('https://');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<string | null>(null);
  const [data, setData]         = useState<PreviewOK | null>(null);

  async function run() {
    setStatus(null);
    setData(null);
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { setStatus('Du er ikke logget ind. Gå til /login'); return; }

      const resp = await fetch('/api/brand/scrape/preview', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ website })
      });

      const ct = resp.headers.get('content-type') || '';
      const payload: PreviewOK | PreviewErr = ct.includes('application/json')
        ? await resp.json()
        : ({ ok:false, error: await resp.text() } as PreviewErr);

      if (!resp.ok || payload.ok === false) {
        setStatus(`Fejl (${resp.status}): ${'error' in payload ? payload.error : 'Ukendt'}`);
        return;
      }

      setData(payload);
    } catch (e:any) {
      setStatus('Teknisk fejl: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto' }}>
      <h2>Brand-preview (midlertidig testside)</h2>
      <p style={{ color:'#555' }}>Skriv caféens hjemmeside og klik “Hent preview”.</p>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'12px 0' }}>
        <input
          style={{ flex:'1 1 380px', minWidth:300 }}
          value={website}
          onChange={e=>setWebsite(e.target.value)}
          placeholder="https://din-cafe.dk/"
        />
        <button onClick={run} disabled={loading}>{loading ? 'Henter…' : 'Hent preview'}</button>
      </div>

      {status && <p style={{ color:'#b00' }}>{status}</p>}

      {data && (
        <section style={{ marginTop:16, display:'grid', gap:16 }}>
          <div style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
            <h3 style={{ marginTop:0 }}>Forslag</h3>
            <p><strong>Domæne:</strong> {data.source_domain}</p>
            {data.proposal.hero_image_url && (
              <img
                src={data.proposal.hero_image_url}
                alt="Hero"
                style={{ maxWidth:'100%', height:'auto', borderRadius:8, border:'1px solid #ddd' }}
              />
            )}
            <p><strong>Opsummering:</strong> {data.proposal.summary_text}</p>
            <p><strong>Nøgleord:</strong> {data.proposal.keywords.join(', ') || '(ingen)'}</p>
          </div>

          <div style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
            <h3 style={{ marginTop:0 }}>Fundne sider</h3>
            <ul style={{ margin:0, paddingLeft:18 }}>
              {data.previews.map((p,i)=>(
                <li key={i} style={{ marginBottom:10 }}>
                  <div><a href={p.url} target="_blank" rel="noreferrer">{p.title || p.url}</a></div>
                  <small style={{ color:'#555' }}>{p.snippet}</small>
                </li>
              ))}
            </ul>
          </div>

          <details>
            <summary>Se rå JSON</summary>
            <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
