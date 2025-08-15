// app/welcome/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WelcomePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hent bruger efter redirect fra Magic link / Google
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setEmail(user?.email ?? null);
      setLoading(false);
    })();

    // Opdater straks hvis session ændrer sig
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setEmail(session?.user?.email ?? null);
      setLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); mounted = false; };
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: '24px auto' }}>
      <h2>Velkommen!</h2>

      {loading && <p>Logger ind…</p>}

      {!loading && email && (
        <>
          <p>Du er logget ind som <strong>{email}</strong>.</p>
          <p style={{ marginTop: 12 }}>
            Gå til <a href="/posts">Dine opslag</a> eller <a href="/posts/new">Opret nyt opslag</a>.
          </p>
        </>
      )}

      {!loading && !email && (
        <>
          <p>Vi kunne ikke se en aktiv session.</p>
          <p>
            Prøv igen via <a href="/auth?mode=login">Log ind</a> eller <a href="/auth?mode=signup">Opret gratis konto</a>.
          </p>
        </>
      )}
    </main>
  );
}
