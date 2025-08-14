'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function WelcomePage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main>
      <h2>Du er logget ind</h2>
      <p>{email ? `Som: ${email}` : 'Henter bruger...'}</p>
      <p><a href="/">Til forsiden</a> · <button onClick={logout}>Log ud</button></p>
    </main>
  );
}
