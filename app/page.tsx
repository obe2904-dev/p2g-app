'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) { setIsAuthed(false); setChecking(false); }
        return;
      }
      setIsAuthed(true);

      // tjek onboarding
      const { data: prof } = await supabase
        .from('profiles')
        .select('default_org_id, tos_accept_at, dpa_accept_at')
        .maybeSingle();

      const needsOnboarding = !prof?.default_org_id || !prof?.tos_accept_at || !prof?.dpa_accept_at;

      if (!cancelled) {
        setChecking(false);
        if (needsOnboarding) router.replace('/welcome');
        else router.replace('/main'); // ✅ logget ind + onboardet → videre til overblik
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Mens vi tjekker login, vis kort besked
  if (checking) return <main><p>Henter side…</p></main>;

  // Ikke logget ind → vis offentlig landing (helt simpel placeholder)
  if (!isAuthed) {
    return (
      <main style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 8 }}>Post2Grow til caféer</h1>
        <p style={{ color:'#555', marginBottom: 16 }}>
          Få idéer, tekstforslag og billedtjek. Start gratis – ingen kreditkort.
        </p>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom: 20 }}>
          <a href="/auth?mode=signup" style={{ padding:'10px 14px', border:'1px solid #000', borderRadius:8, textDecoration:'none' }}>
            Opret gratis konto
          </a>
          <a href="/auth?mode=login" style={{ padding:'10px 14px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none' }}>
            Log ind
          </a>
          <a href="/pricing" style={{ padding:'10px 14px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none' }}>
            Priser
          </a>
          <a href="/welcome" style={{ padding:'10px 14px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none' }}>
            Sådan fungerer onboarding
          </a>
        </div>

        <section style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div style={{ border:'1px solid #eee', borderRadius:12, padding:14 }}>
            <strong>Idéer & tekstforslag</strong>
            <p style={{ margin:'6px 0 0' }}>AI hjælper dig på få sekunder.</p>
          </div>
          <div style={{ border:'1px solid #eee', borderRadius:12, padding:14 }}>
            <strong>Billedtjek</strong>
            <p style={{ margin:'6px 0 0' }}>Lys, format og skarphed før du poster.</p>
          </div>
          <div style={{ border:'1px solid #eee', borderRadius:12, padding:14 }}>
            <strong>Performance</strong>
            <p style={{ margin:'6px 0 0' }}>Se hvad der virker.</p>
          </div>
        </section>
      </main>
    );
  }

  // Hvis vi ER logget ind, når vi rammer her, har useEffect allerede redirectet.
  return <main><p>Sender dig videre…</p></main>;
}
