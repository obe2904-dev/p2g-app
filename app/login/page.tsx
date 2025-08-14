'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sender login-link...');
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
      <h2>Login</h2>
      <form onSubmit={sendMagicLink} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
        <label>E-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@mail.dk" />
        <button type="submit">Send magic link</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
