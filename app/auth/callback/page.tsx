'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) OAuth (code i query) – prøv at bytte code for session
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          // supabase-js kan selv læse hele URL'en
          await supabase.auth.exchangeCodeForSession(window.location.href as any).catch(() => {});
        }
        // 2) Magic-link (access_token i hash) – læs og gem session
        await supabase.auth.getSession().catch(() => {});
      } finally {
        // 3) Videre: welcome afgør selv om du skal til onboarding eller dashboard
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
