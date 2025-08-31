'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = { id:number; title:string|null; created_at:string; status:string|null };

export default function PostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts_app')
      .select('id, title, created_at, status')
      .order('created_at', { ascending: false });
    if (error) setError(error.message); else setRows((data || []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function remove(id:number) {
    const sure = window.confirm('Dette vil slette opslag permanent. Er du sikker?');
    if (!sure) return;
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setInfo('Ikke logget ind.'); return; }
    const resp = await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id })
    });
    if (!resp.ok) { setInfo('Fejl: ' + (await resp.text())); return; }
    setInfo('Slettet ✔');
    load();
  }

  return (
    <main>
      <h2>Dine opslag</h2>
      <div style={{ marginBottom: 8 }}>
        <a href="/posts/new">+ Nyt opslag</a>
      </div>
      {error && <p>Fejl: {error}</p>}
      {info && <p>{info}</p>}
      {loading ? (
        <p>Henter…</p>
      ) : rows.length === 0 ? (
        <p>Ingen opslag endnu. <a href="/posts/new">Opret et nyt</a>.</p>
      ) : (
        <table style={{ borderCollapse:'collapse', minWidth: 640 }}>
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
                <td style={{ padding:6 }}>
                  <Link href={`/posts/${r.id}/edit`}>{r.title || '(uden titel)'}</Link>
                </td>
                <td style={{ padding:6 }}>{r.status || '-'}</td>
                <td style={{ padding:6 }}>{new Date(r.created_at).toLocaleString('da-DK')}</td>
                <td style={{ padding:6, display:'flex', gap:8 }}>
                  <a href={`/posts/${r.id}/edit`}>Redigér</a>
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
