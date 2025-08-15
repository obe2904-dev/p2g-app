'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setOk(!!user);
    })();
  }, []);
  if (ok === null) return <p>Henter…</p>;
  if (!ok) {
    return (
      <div>
        <p>Du skal være logget ind for at se denne side.</p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { mode: 'login' } }))}>
          Log ind
        </button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-auth', { detail: { mode: 'signup' } }))} style={{ marginLeft:8 }}>
          Opret gratis konto
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
