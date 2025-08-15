'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Er der en aktiv session?
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Ikke logget ind → send til login (bevarer evt. "next" destination)
        const next = encodeURIComponent(pathname || '/');
        if (!cancelled) router.replace(`/auth?mode=login&next=${next}`);
        return;
      }

      // 2) Har brugeren fuldført onboarding?
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('default_org_id, tos_accept_at, dpa_accept_at')
        .maybeSingle();

      // Hvis fejl, lad os i det mindste prøve at sende videre til welcome
      const needsOnboarding =
        !prof?.default_org_id || !prof?.tos_accept_at || !prof?.dpa_accept_at;

      if (needsOnboarding && pathname !== '/welcome') {
        if (!cancelled) router.replace('/welcome');
        return;
      }

      if (!cancelled) setChecking(false);
    })();

    return () => { cancelled = true; };
  }, [router, pathname]);

  if (checking) return <main><p>Tjekker adgang…</p></main>;
  return <>{children}</>;
}
