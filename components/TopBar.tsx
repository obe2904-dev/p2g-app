// components/TopBar.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Profile = { full_name: string | null; plan_id: string | null };

function planLabel(p?: string | null) {
  switch ((p || '').toLowerCase()) {
    case 'premium': return 'Premium';
    case 'pro': return 'Pro';
    case 'basic': return 'Basic';
    case 'free':
    default: return 'Gratis';
  }
}

export default function TopBar() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      // Hent bruger
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id || null;
      setEmail(u.user?.email || '');

      // Hent profil for netop denne bruger (mere robust end maybeSingle uden filter)
      if (uid) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, plan_id')
          .eq('user_id', uid)
          .maybeSingle();

        setProfile((data || null) as Profile | null);
      } else {
        setProfile(null);
      }
    })();
  }, []);

  const firstName =
    (profile?.full_name || '')
      .trim()
      .split(/\s+/)[0] || (email ? email.split('@')[0] : 'der');

  const plan = (profile?.plan_id || 'free').toLowerCase();

  async function logout() {
    await supabase.auth.signOut();
    // tilbage til login
    window.location.href = '/auth?mode=login';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ fontWeight: 600 }}>
        Velkommen tilbage, {firstName} <span aria-hidden>👋</span>
      </div>

      <div
        title={`Din nuværende plan: ${planLabel(plan)}`}
        style={{
          marginLeft: 12,
          fontSize: 12,
          border: '1px solid #ddd',
          borderRadius: 999,
          padding: '2px 10px',
          background: '#fafafa'
        }}
      >
        Plan: <strong>{planLabel(plan)}</strong>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Link
          href="/profile"
          style={{
            padding: '8px 10px',
            border: '1px solid #ddd',
            borderRadius: 8,
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          Profil
        </Link>
        <button
          onClick={logout}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          Log ud
        </button>
      </div>
    </div>
  );
}
