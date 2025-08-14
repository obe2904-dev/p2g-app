'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NewPost() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Gemmer...');

    const { data: sessionData } = await supabase.auth.getSession();
    const access_token = sessionData.session?.access_token;
    if (!access_token) {
      setStatus('Du er ikke logget ind. Gå til /login');
      return;
    }

    const resp = await fetch('/api/posts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + access_token,
      },
      body: JSON.stringify({ title, body, image_url: imageUrl })
    });

    if (!resp.ok) {
      const text = await resp.text();
      setStatus('Fejl: ' + text);
    } else {
      setStatus('Gemt! Gå til "Dine opslag" for at se det.');
      setTitle(''); setBody(''); setImageUrl('');
    }
  }

  return (
    <main>
      <h2>Nyt opslag</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>Titel (valgfri)</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} />
        <label>Tekst (påkrævet)</label>
        <textarea required rows={5} value={body} onChange={e=>setBody(e.target.value)} />
        <label>Billede-URL (valgfri)</label>
        <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..."/>
        <div style={{ display:'flex', gap:8 }}>
          <button type="submit">Gem opslag</button>
        </div>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
