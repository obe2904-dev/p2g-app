'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Dette kald får supabase-js til at læse #access_token fra URL’en og gemme sessionen
      await supabase.auth.getSession();

      // Send brugeren videre: /welcome afgør selv om onboarding er færdig
      router.replace('/auth/callback');
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 420, margin: '24px auto' }}>
      <p>Logger ind…</p>
    </main>
  );
}
