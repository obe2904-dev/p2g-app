'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Row = { id:number; title:string|null; created_at:string; status:string|null };

export default function PostsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('posts_app')
        .select('id, title, created_at, status')
        .order('created_at', { ascending: false });
      if (error) setError(error.message); else setRows((data || []) as Row[]);
    }
    load();
  }, []);

  return (
    <main>
      <h2>Dine opslag</h2>
      {error && <p>Fejl: {error}</p>}
      {rows.length === 0 ? (
        <p>Ingen opslag endnu. <a href="/posts/new">Opret et nyt</a>.</p>
      ) : (
        <table style={{ borderCollapse:'collapse', minWidth: 520 }}>
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
                <td style={{ padding:6 }}>{r.title || '(uden titel)'}</td>
                <td style={{ padding:6 }}>{r.status || 'draft'}</td>
                <td style={{ padding:6 }}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ padding:6, display:'flex', gap:8 }}>
                  <Link href={`/posts/${r.id}/edit`}>Redigér</Link>
                  <Link href={`/posts/${r.id}/edit?dup=1`}>Kopiér</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
