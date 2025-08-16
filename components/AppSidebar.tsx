// components/AppSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = { full_name: string | null; plan_id: string | null };

function planLabel(p?: string | null) {
  switch ((p || '').toLowerCase()) {
    case 'pro': return 'Pro';
    case 'premium': return 'Premium';
    case 'basic': return 'Basic';
    case 'free':
    default: return 'Gratis';
  }
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email || '');
      const { data } = await supabase
        .from('profiles')
        .select('full_name, plan_id')
        .maybeSingle();
      setProfile(data as Profile);
    })();
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/') ? '#f5f5f5' : 'transparent';

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/auth?mode=login';
  }

  const plan = (profile?.plan_id || 'free').toLowerCase();
  const showUpgrade = plan === 'free' || plan === 'pro'; // kun Gratis og Pro

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100%' }}>
      {/* Top: navn, e-mail, plan */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>Post2Grow Café</div>
        <div style={{ fontSize: 12, color: '#555' }}>
          {profile?.full_name || 'Bruger'}
        </div>
        <div style={{ fontSize: 12, color: '#777' }}>{email}</div>
        <div
          title={`Din nuværende plan: ${planLabel(plan)}`}
          style={{
            marginTop: 6,
            fontSize: 12,
            border: '1px solid #ddd',
            borderRadius: 999,
            padding: '2px 10px',
            display: 'inline-block',
            background: '#fafafa'
          }}
        >
          Plan: <strong>{planLabel(plan)}</strong>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'grid', gap: 4 }}>
        <Link href="/" style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isActive('/'),
          textDecoration: 'none',
          color: 'inherit'
        }}>Dashboard</Link>

        <Link href="/brand" style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isActive('/brand'),
          textDecoration: 'none',
          color: 'inherit'
        }}>Brandprofil</Link>

        <Link href="/calendar" style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isActive('/calendar'),
          textDecoration: 'none',
          color: 'inherit'
        }}>Kalender</Link>

        <Link href="/posts" style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isActive('/posts'),
          textDecoration: 'none',
          color: 'inherit'
        }}>Opslag</Link>

        <Link href="/gallery" style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: isActive('/gallery'),
          textDecoration: 'none',
          color: 'inherit'
        }}>Billeder og video</Link>

        {showUpgrade && (
          <Link href="/pricing?from=sidebar" style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            textDecoration: 'none',
            color: 'white',
            background: '#111',
            textAlign: 'center',
            fontWeight: 600
          }}>
            Opgradér
          </Link>
        )}
      </nav>

      {/* Bund: log ud */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ddd',
            borderRadius: 8,
            background: 'white',
            cursor: 'pointer'
          }}
        >
          Log ud
        </button>
      </div>
    </div>
  );
}
