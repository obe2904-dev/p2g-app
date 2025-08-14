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
      <label>Upload billede (valgfri)</label>
      <input type="file" accept="image/*" onChange={handleFile} />
    });

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  setStatus('Uploader billede...');

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) { setStatus('Du er ikke logget ind. Gå til /login'); return; }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uid}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from('images')            // husk: bucket "images" skal være oprettet i Supabase Storage (Public = ON)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (upErr) { setStatus('Upload-fejl: ' + upErr.message); return; }

  const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
  const url = pub.publicUrl;

  setImageUrl(url);  // udfylder automatisk dit Billede-URL-felt
  setStatus('Billede uploadet ✔ Du kan nu klikke "Analyser billede" eller gemme opslaget.');
}

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
