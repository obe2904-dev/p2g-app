// app/(app)/posts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: number;
  title: string | null;
  created_at: string;
  status: string | null;
};

export default function PostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('posts_app')
      .select('id, title, created_at, status')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows((data || []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: number) {
    const sure = window.confirm('Dette vil slette opslag permanent. Er du sikker?');
    if (!sure) return;

    setInfo('Sletter...');
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setInfo('Ikke logget ind. Gå til /login.'); return; }

    const resp = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id })
    });

    if (!resp.ok) {
      const t = await resp.text();
      setInfo('Fejl: ' + t);
      return;
    }

    setInfo('Slettet ✔');
    load();
  }

  return (
    <main>
      <h2>Dine opslag</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <Link href="/posts/new">Nyt opslag</Link>
        <button onClick={load} disabled={loading}>{loading ? 'Opdaterer…' : 'Opdater'}</button>
      </div>

      {error && <p style={{ color: '#b00' }}>Fejl: {error}</p>}
      {info && <p>{info}</p>}

      {rows.length === 0 ? (
        <p>Ingen opslag endnu. <Link href="/posts/new">Opret et nyt</Link>.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{textAlign:'left', padding:6, borderBottom:'1px solid #ddd'}}>Titel</th>
              <th style={{textAlign:'left', padding:6, borderBottom:'1px solid #ddd'}}>Status</th>
              <th style={{textAlign:'left', padding:6, borderBottom:'1px solid #ddd'}}>Oprettet</th>
              <th style={{textAlign:'left', padding:6, borderBottom:'1px solid #ddd'}}>Handling</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 6 }}>{r.title || '(uden titel)'}</td>
                <td style={{ padding: 6 }}>{r.status || '—'}</td>
                <td style={{ padding: 6 }}>{new Date(r.created_at).toLocaleString('da-DK')}</td>
                <td style={{ padding: 6, display:'flex', gap:8 }}>
                  <Link href={`/posts/${r.id}/edit`}>Redigér</Link>
                  <button onClick={() => remove(r.id)} style={{ color:'#b00' }}>Slet</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
