'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sender link...');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/welcome` : undefined,
      },
    });
    if (error) setStatus('Fejl: ' + error.message);
    else setStatus('Tjek din mail for login-link.');
  }

  return (
    <main>
      <h2>Tilmeld dig Post2Grow — Café</h2>
      <p>Én e-mail er nok. Du modtager et magic link og er i gang på få sekunder.</p>
      <form onSubmit={sendLink} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <label>E-mail</label>
        <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="din@mail.dk"/>
        <button type="submit">Send link</button>
      </form>
      {status && <p>{status}</p>}
      <p style={{ marginTop: 8 }}>Har du allerede en konto? <a href="/login">Log ind her</a>.</p>
    </main>
  );
}
