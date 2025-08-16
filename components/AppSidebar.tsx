 // components/AppSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Plan = 'free' | 'basic' | 'pro' | 'premium' | null;

function NavItem({
  href,
  label,
  currentPath
}: {
  href: string;
  label: string;
  currentPath: string;
}) {
  const active =
    href === '/'
      ? currentPath === '/'
      : currentPath === href || currentPath.startsWith(href + '/');

  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '10px 12px',
        borderRadius: 8,
        textDecoration: 'none',
        color: active ? '#000' : '#333',
        background: active ? '#f3f4f6' : 'transparent',
        border: active ? '1px solid #e5e7eb' : '1px solid transparent',
      }}
    >
      {label}
    </Link>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const [plan, setPlan] = useState<Plan>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('plan_id')
        .maybeSingle();
      const p = (data?.plan_id || 'free').toLowerCase() as Plan;
      setPlan(p);
    })();
  }, []);

  const showUpgrade = plan === 'free' || plan === 'pro'; // synlig i Gratis og Pro

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Logo / brand */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Post2Grow Café</div>
        <div style={{ fontSize: 12, color: '#666' }}>Overblik</div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'grid', gap: 6 }}>
        <NavItem href="/" label="Dashboard" currentPath={pathname} />
        <NavItem href="/brand" label="Brandprofil" currentPath={pathname} />
        <NavItem href="/calendar" label="Kalender" currentPath={pathname} />
        <NavItem href="/posts" label="Opslag" currentPath={pathname} />
        <NavItem href="/gallery" label="Billeder og video" currentPath={pathname} />
        {showUpgrade && (
          <NavItem href="/pricing" label="Opgradér" currentPath={pathname} />
        )}
      </nav>

      {/* Spacer så indholdet skubber evt. bundsektion ned */}
      <div style={{ flex: 1 }} />

      {/* (Tom bund — log ud er flyttet til topbaren) */}
    </div>
  );
}
