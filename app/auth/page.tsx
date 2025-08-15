// app/auth/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Tving siden til at være dynamisk (god praksis for auth-sider)
export const dynamic = 'force-dynamic';

function AuthInner() {
  const sp = useSearchParams();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Læs ?mode=login|signup fra URL’en
  useEffect(() => {
    const m = sp?.get('mode');
    if (m === 'login' || m === 'signup') setMode(m);
  }, [sp]);

  async function withGoogle() {
    setMsg(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/welcome` }
    });
  }

  async function withEmail() {
    setMsg('Sender login-link…');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/welcome` }
    });
    if (error) setMsg('Fejl: ' + error.message);
    else setMsg('Tjek din e-mail og klik på linket for at logge ind.');
  }

  return (
    <main style={{ maxWidth: 420, margin: '24px auto' }}>
      <h2 style={{ marginBottom: 8 }}>
        {mode === 'signup' ? 'Opret gratis konto' : 'Log ind'}
      </h2>
      <p style={{ color:'#555' }}>
        {mode === 'signup' ? 'Vælg en metode' : 'Velkommen tilbage'}
      </p>

      <div style={{ display:'grid', gap:12, marginTop:16 }}>
        <button onClick={withGoogle} style={{ padding:10, border:'1px solid #ddd', borderRadius:8 }}>
          {mode === 'signup' ? 'Opret dig med Google' : 'Log ind med Google'}
        </button>

        <div>
          <label>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="din@epost.dk"
            style={{ width:'100%' }}
          />
        </div>
        <button onClick={withEmail} style={{ padding:10, border:'1px solid #000', borderRadius:8 }}>
          {mode === 'signup' ? 'Opret dig med e-mail (magic link)' : 'Log ind med e-mail (magic link)'}
        </button>

        <small style={{ color:'#555' }}>
          {mode === 'signup' ? 'Har du allerede en konto?' : 'Ny hos os?'}{' '}
          <a href={`/auth?mode=${mode === 'signup' ? 'login' : 'signup'}`} style={{ textDecoration:'underline' }}>
            {mode === 'signup' ? 'Log ind' : 'Opret gratis konto'}
          </a>
        </small>

        {msg && <p>{msg}</p>}
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 420, margin: '24px auto' }}><p>Indlæser…</p></main>}>
      <AuthInner />
    </Suspense>
  );
}
