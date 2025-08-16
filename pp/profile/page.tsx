// app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RequireAuth from '@/components/RequireAuth';

type Profile = { full_name: string | null; phone: string | null };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        setEmail(u.user?.email || '');

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .maybeSingle();

        if (!error) setProfile(data as Profile);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <RequireAuth>
      <main style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2>Profil</h2>
        <p style={{ color:'#555', marginTop: -4 }}>Dine personlige oplysninger (ikke café-oplysninger).</p>

        {loading ? (
          <p>Henter…</p>
        ) : (
          <section style={{ marginTop: 12, border:'1px solid #eee', borderRadius:8, padding:12 }}>
            <div style={{ display:'grid', gap:8 }}>
              <div>
                <label style={{ display:'block', fontSize:12, color:'#555' }}>Navn</label>
                <input readOnly value={profile?.full_name || ''} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'#555' }}>E-mail</label>
                <input readOnly value={email} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'#555' }}>Telefon</label>
                <input readOnly value={profile?.phone || ''} />
              </div>
            </div>
            <p style={{ marginTop:12, fontSize:12, color:'#777' }}>
              Redigering kommer senere. Kontakt os, hvis noget skal ændres nu.
            </p>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
