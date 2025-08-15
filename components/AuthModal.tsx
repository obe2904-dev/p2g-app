'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthModal({
  open, mode, onClose
}: { open: boolean; mode: 'signup'|'login'; onClose: () => void; }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) return null;

  async function withGoogle() {
    setMsg(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/welcome` }
    });
  }

  async function withEmail() {
    setMsg('Sender magic link…');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/welcome` }
    });
    if (error) setMsg('Fejl: ' + error.message);
    else setMsg('Tjek din e-mail for loginlink.');
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.35)',
      display:'grid', placeItems:'center', zIndex:1000
    }}>
      <div style={{ background:'#fff', width: 400, maxWidth:'90vw', borderRadius:12, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0 }}>{mode === 'signup' ? 'Opret gratis konto' : 'Log ind'}</h3>
          <button onClick={onClose} aria-label="Luk">×</button>
        </div>

        <div style={{ display:'grid', gap:10, marginTop:12 }}>
          <button onClick={withGoogle} style={{ padding:10, border:'1px solid #ddd', borderRadius:8 }}>
            {mode === 'signup' ? 'Opret dig med Google' : 'Log ind med Google'}
          </button>

          <div>
            <label>E-mail</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="din@epost.dk" style={{ width:'100%' }} />
          </div>
          <button onClick={withEmail} style={{ padding:10, border:'1px solid #000', borderRadius:8 }}>
            {mode === 'signup' ? 'Opret dig med e-mail' : 'Log ind med e-mail'}
          </button>

          <small style={{ color:'#555' }}>
            {mode === 'signup' ? 'Har du allerede en konto?' : 'Ny hos os?'}{' '}
            <button
            onClick={() => { /* toggle mode without closing */ (mode === 'signup') ? (window.dispatchEvent(new CustomEvent('open-auth', { detail:{ mode:'login' } })), onClose()) : (window.dispatchEvent(new CustomEvent('open-auth', { detail:{ mode:'signup' } })), onClose()); }}
            style={{ textDecoration:'underline' }}
            >
          {mode === 'signup' ? 'Log ind' : 'Opret gratis konto'}
          </button>
      </small>
        </div>

        <div style={{ marginTop:8 }}>
          {msg && <p>{msg}</p>}
        </div>

        <div style={{ marginTop:8 }}>
          <button onClick={onClose} className="underline">Luk</button>
          <button onClick={() => { /* swap mode */ }} style={{ marginLeft:8 }} />
        </div>
      </div>
    </div>
  );
}
