'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WelcomePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      setEmail(user?.email ?? null);
      if (!user) return;

      // Kald init‑API for at gemme branch i profiles
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      try {
        const resp = await fetch('/api/profile/init', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!resp.ok) {
          const t = await resp.text();
          setStatus('Profil kunne ikke oprettes: ' + t);
        } else {
          setStatus('Profil gemt.');
        }
      } catch (e: any) {
        setStatus('Netværksfejl: ' + e.message);
      }
    }
    run();
  }, []);

  return (
    <main>
      <h2>Du er logget ind</h2>
      <p>{email ? `Som: ${email}` : 'Henter bruger...'}</p>
      {status && <p>{status}</p>}
      <p><a href="/">Til forsiden</a></p>
    </main>
  );
}
