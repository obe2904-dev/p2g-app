'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function WelcomeWizard() {
  const router = useRouter();

  // Felter (obligatoriske)
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName]   = useState('');
  const [city, setCity]         = useState('');

  // Felter (valgfri i Gratis)
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone]     = useState('');

  // Samtykker
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  // Prefill & “er onboarding allerede fuldført?”
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Hent profil til prefill + check
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('full_name, default_org_id, tos_accept_at, dpa_accept_at')
          .maybeSingle();

        if (error) {
          setMsg('Kunne ikke hente profil: ' + error.message);
        } else {
          if (prof?.full_name) setFullName(prof.full_name);
          const already =
            !!prof?.default_org_id && !!prof?.tos_accept_at && !!prof?.dpa_accept_at;

          if (already) {
            // Onboarding udført – send videre til app
            router.push('/posts');
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    // Basic validering
    if (!fullName || !orgName || !city) {
      setMsg('Udfyld venligst Navn, Caféens navn og By.');
      return;
    }
    if (!acceptTos || !acceptDpa) {
      setMsg('Du skal acceptere Vilkår og Databehandleraftale for at fortsætte.');
      return;
    }

    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        setMsg('Du er ikke logget ind. Prøv igen.');
        return;
      }

      const resp = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          full_name: fullName,
          org_name: orgName,
          city,
          website: website || undefined,
          address: address || undefined,
          phone: phone || undefined,
          accept_tos: acceptTos,
          accept_dpa: acceptDpa,
          tos_version: 'v0.1',
          dpa_version: 'v0.1'
        })
      });

      if (!resp.ok) {
        const text = await resp.text();
        setMsg('Fejl: ' + text);
        return;
      }

      // Succes → ind i appen
      router.push('/posts');
    } catch (e:any) {
      setMsg('Fejl: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main><p>Henter…</p></main>;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2>Velkommen! Lad os sætte din café op</h2>
      <p style={{ color:'#555' }}>Det tager under 1 minut. Felter markeret med * er obligatoriske.</p>

      <form onSubmit={submit} style={{ display:'grid', gap:10 }}>
        {/* Trin 1: Obligatorisk */}
        <fieldset style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
          <legend style={{ padding:'0 6px' }}>Trin 1 · Grundoplysninger *</legend>

          <label>Dit navn *</label>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} required />

          <label>Caféens navn *</label>
          <input value={orgName} onChange={e=>setOrgName(e.target.value)} required />

          <label>By *</label>
          <input value={city} onChange={e=>setCity(e.target.value)} required />
        </fieldset>

        {/* Trin 2: Valgfrit (Gratis) */}
        <fieldset style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
          <legend style={{ padding:'0 6px' }}>Trin 2 · (Valgfrit)</legend>

          <label>Hjemmeside</label>
          <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://..." />

          <label>Adresse</label>
          <input value={address} onChange={e=>setAddress(e.target.value)} />

          <label>Telefon</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} />
        </fieldset>

        {/* Samtykker */}
        <fieldset style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
          <legend style={{ padding:'0 6px' }}>Samtykke *</legend>

          <label style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="checkbox" checked={acceptTos} onChange={e=>setAcceptTos(e.target.checked)} />
            <span>Jeg accepterer <a href="/legal/terms" target="_blank" rel="noreferrer">Vilkår</a>.</span>
          </label>

          <label style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="checkbox" checked={acceptDpa} onChange={e=>setAcceptDpa(e.target.checked)} />
            <span>Jeg accepterer <a href="/legal/dpa" target="_blank" rel="noreferrer">Databehandleraftalen</a>.</span>
          </label>
        </fieldset>

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <button type="submit" disabled={saving}>{saving ? 'Gemmer…' : 'Færdiggør opsætning'}</button>
          <a href="/posts">Spring over</a>
        </div>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </form>
    </main>
  );
}
