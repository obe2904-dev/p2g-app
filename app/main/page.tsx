'use client';

import RequireAuth from '@/components/RequireAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MainPage() {
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .maybeSingle();
      if (prof?.full_name) setFullName(prof.full_name);
    })();
  }, []);

  return (
    <RequireAuth>
      <main style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2>Overblik</h2>
        <p style={{ color:'#555' }}>
          {fullName ? `Hej ${fullName}!` : 'Hej!'} Her er dine genveje:
        </p>

        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))' }}>
          <a href="/posts" style={{ border:'1px solid #ddd', borderRadius:12, padding:14, textDecoration:'none' }}>
            <strong>Dine opslag</strong>
            <div>Se, redigér og slet</div>
          </a>

          <a href="/posts/new" style={{ border:'1px solid #ddd', borderRadius:12, padding:14, textDecoration:'none' }}>
            <strong>Nyt opslag</strong>
            <div>Få AI-hjælp til tekst og foto</div>
          </a>

          <a href="/performance" style={{ border:'1px solid #ddd', borderRadius:12, padding:14, textDecoration:'none' }}>
            <strong>Effekt</strong>
            <div>Overblik over performance</div>
          </a>

          <a href="/pricing" style={{ border:'1px solid #ddd', borderRadius:12, padding:14, textDecoration:'none' }}>
            <strong>Priser</strong>
            <div>Opgradér din plan</div>
          </a>
        </div>

        <p style={{ marginTop:16, color:'#777' }}>
          (Denne side er en simpel placeholder – vi kan senere vise seneste opslag, AI-forbrug m.m.)
        </p>
      </main>
    </RequireAuth>
  );
}
