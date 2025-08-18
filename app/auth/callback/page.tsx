'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) Magic link: tokens i URL-hash
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            // Fjern hash fra adresselinjen
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
        // 2) OAuth (Google): code-flow
        else if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }
        // 3) Fallback: hent aktuel session hvis allerede sat
        else {
          await supabase.auth.getSession();
        }
      } finally {
        // Lad /welcome afgøre onboarding → dashboard
        router.replace('/welcome');
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 420, margin: '24px auto' }}>
      <p>Logger ind…</p>
    </main>
  );
}
