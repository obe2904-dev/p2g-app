// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type Profile = { full_name: string | null; plan_id: string | null };

function planLabel(p?: string | null) {
  switch ((p || '').toLowerCase()) {
    case 'free': return 'Gratis';
    case 'basic': return 'Basic';
    case 'pro': return 'Pro';
    case 'premium': return 'Premium';
    default: return 'Gratis';
  }
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, plan_id')
          .maybeSingle();
        if (!error) setProfile(data as Profile);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const plan = profile?.plan_id || 'free';
  const ctaLabel = (plan === 'pro' || plan === 'premium') ? 'Planlæg opslag' : 'Opret opslag';

  return (
    <RequireAuth>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 16px' }}>
        {/* Header-linje */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          margin: '8px 0 16px'
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <h2 style={{ margin: 0 }}>
              Velkommen tilbage{profile?.full_name ? `, ${profile.full_name}` : ''} 👋
            </h2>
            <span
              title={`Din nuværende plan: ${planLabel(plan)}`}
              style={{
                fontSize: 12,
                border: '1px solid #ddd',
                borderRadius: 999,
                padding: '2px 10px',
                background: '#fafafa'
              }}
            >
              Plan: <strong>{planLabel(plan)}</strong>
            </span>
            <Link href="/pricing" style={{ fontSize: 12, textDecoration: 'underline' }}>
              Opgradér
            </Link>
          </div>

          <Link
            href="/posts/new"
            style={{
              border: '1px solid #111',
              borderRadius: 8,
              padding: '8px 12px',
              textDecoration: 'none'
            }}
          >
            {ctaLabel}
          </Link>
        </div>

        {/* (Plads til næste felter på Overblik – vi bygger dem ét ad gangen) */}
        {loading && <p>Henter…</p>}
      </main>
    </RequireAuth>
  );
}
