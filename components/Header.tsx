'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from './AuthModal';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signup'|'login'>('signup');
  const router = useRouter();
  const pathname = usePathname();

  // Lyt efter globale events fra knapper andre steder (fx landing)
  useEffect(() => {
    function onOpen(e: any) {
      setMode(e?.detail?.mode === 'login' ? 'login' : 'signup');
      setOpen(true);
    }
    window.addEventListener('open-auth', onOpen as any);
    return () => window.removeEventListener('open-auth', onOpen as any);
  }, []);

  // Tjek auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setIsLoggedIn(!!user);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => { sub.subscription.unsubscribe(); mounted = false; };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  // Nav items
  const guestLinks = (
    <>
      {/* Ingen 'Forside' i menuen – logo/klik på / håndterer forsiden */}
      <Link href="/solutions">Løsninger</Link>
      <Link href="/pricing">Priser</Link>
      <Link href="/om">Om</Link>
      <button onClick={() => { setMode('login'); setOpen(true); }} className="underline">Login</button>
      <button onClick={() => { setMode('signup'); setOpen(true); }} style={{ padding: '6px 10px', border: '1px solid #000', borderRadius: 8 }}>
        Opret gratis konto
      </button>
    </>
  );

  const userLinks = (
    <>
      <Link href="/posts">Dine opslag</Link>
      <Link href="/posts/new">Nyt opslag</Link>
      <Link href="/performance">Effekt</Link>
      <button onClick={logout} className="underline">Log ud</button>
    </>
  );

  return (
    <header style={{ borderBottom: '1px solid #eee' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" style={{ fontWeight: 700 }}>Post2Grow Café</Link>
        <nav style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
          {isLoggedIn ? userLinks : guestLinks}
        </nav>
      </div>
      <AuthModal open={open} mode={mode} onClose={() => setOpen(false)} />
    </header>
  );
}
