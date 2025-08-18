'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) Magic-link: tokens i hash (#access_token=…&refresh_token=…)
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }

          // ryd hash for pæn URL
          window.history.replaceState({}, '', window.location.pathname);
          router.replace('/dashboard');
          return;
        }

        // 2) OAuth (Google): kode i query (?code=…)
        const search = typeof window !== 'undefined' ? window.location.search : '';
        if (search.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
          router.replace('/dashboard');
          return;
        }

        // 3) Fald-tilbage: hvis der allerede er en session → /dashboard, ellers /auth
        const { data: { session } } = await supabase.auth.getSession();
        router.replace(session ? '/dashboard' : '/auth');
      } catch {
        router.replace('/auth');
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 420, margin: '24px auto' }}>
      <p>Logger ind…</p>
    </main>
  );
}
