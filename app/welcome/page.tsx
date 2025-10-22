'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Lille DK postnummer → by opslag (MVP). Kan altid udvides/erstattes med officiel API senere.
const ZIP_TO_CITY: Record<string, string> = {
  '1000': 'København K', '1050': 'København K', '1100': 'København K', '1200': 'København K', '1250': 'København K',
  '1300': 'København K', '1350': 'København K', '1360': 'København K', '1400': 'København K', '1450': 'København K',
  '1500': 'København V', '1550': 'København V', '1600': 'København V', '1650': 'København V', '1700': 'København V',
  '1800': 'Frederiksberg C', '1810': 'Frederiksberg C', '1820': 'Frederiksberg C', '1850': 'Frederiksberg C',
  '1860': 'Frederiksberg C', '1870': 'Frederiksberg C', '1900': 'Frederiksberg C', '1910': 'Frederiksberg C',
  '1920': 'Frederiksberg C', '1950': 'Frederiksberg C', '1960': 'Frederiksberg C', '1970': 'Frederiksberg C',
  '1999': 'Frederiksberg C',
  '2000': 'Frederiksberg', '2100': 'København Ø', '2200': 'København N', '2300': 'København S', '2400': 'København NV',
  '2450': 'København SV', '2500': 'Valby', '2600': 'Glostrup', '2700': 'Brønshøj', '2720': 'Vanløse',
  '2800': 'Kongens Lyngby', '2900': 'Hellerup',
  '4000': 'Roskilde', '4300': 'Holbæk', '4400': 'Kalundborg',
  '5000': 'Odense C', '5200': 'Odense V', '5220': 'Odense SØ', '5230': 'Odense M',
  '6000': 'Kolding', '6100': 'Haderslev', '6200': 'Aabenraa', '6300': 'Gråsten', '6400': 'Sønderborg',
  '6700': 'Esbjerg', '6800': 'Varde',
  '7100': 'Vejle', '7200': 'Grindsted', '7300': 'Jelling', '7400': 'Herning',
  '8000': 'Aarhus C', '8200': 'Aarhus N', '8210': 'Aarhus V', '8230': 'Åbyhøj', '8240': 'Risskov', '8260': 'Viby J',
  '8700': 'Horsens', '8800': 'Viborg', '8900': 'Randers C',
  '9000': 'Aalborg', '9200': 'Aalborg SV', '9210': 'Aalborg SØ', '9220': 'Aalborg Øst', '9400': 'Nørresundby',
  '9800': 'Hjørring',
  '3700': 'Rønne'
};

export default function WelcomeWizard() {
  const router = useRouter();

  // Felter (obligatoriske)
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName]   = useState('');
  const [zip, setZip]           = useState('');
  const [city, setCity]         = useState('');

  // Felter (valgfri i Gratis)
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone]     = useState('');

  // Samlet samtykke (én checkbox)
  const [acceptAll, setAcceptAll] = useState(false);

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
            router.push('/');
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Autoudfyld by når postnummer er 4 cifre (kan altid overstyres manuelt)
  function onZipChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setZip(cleaned);
    if (cleaned.length === 4) {
      const found = ZIP_TO_CITY[cleaned];
      if (found) setCity(found);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    // Basic validering
    if (!fullName || !orgName || !zip) {
      setMsg('Udfyld venligst Navn, Caféens navn og Postnummer.');
      return;
    }
    if (!city) {
      setMsg('Udfyld venligst By (autoudfyldt fra postnummer – eller skriv den manuelt).');
      return;
    }
    if (!acceptAll) {
      setMsg('Du skal acceptere Vilkår og Databehandleraftalen for at fortsætte.');
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
          city,                          // vi gemmer byen (postnummer kan vi tilføje i DB senere hvis ønsket)
          website: website || undefined,
          address: address || undefined,
          phone: phone || undefined,
          accept_tos: acceptAll,
          accept_dpa: acceptAll,
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
      router.push('/');
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

          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:8 }}>
            <div>
              <label>Postnummer *</label>
              <input
                value={zip}
                onChange={e=>onZipChange(e.target.value)}
                inputMode="numeric"
                pattern="\d{4}"
                placeholder="1234"
                required
              />
            </div>
            <div>
              <label>By</label>
              <input
                value={city}
                onChange={e=>setCity(e.target.value)}
                placeholder="Autoudfyldes fra postnummer (kan rettes)"
              />
            </div>
          </div>
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

        {/* Samtykke — én sætning, ét flueben */}
        <fieldset style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
          <legend style={{ padding:'0 6px' }}>Samtykke *</legend>
          <label style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <input
              type="checkbox"
              checked={acceptAll}
              onChange={e=>setAcceptAll(e.target.checked)}
            />
            <span>
              Jeg accepterer <a href="/legal/terms" target="_blank" rel="noreferrer">Vilkår</a> og{' '}
              <a href="/legal/dpa" target="_blank" rel="noreferrer">Databehandleraftalen</a>.
            </span>
          </label>
        </fieldset>

        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <button type="submit" disabled={saving}>{saving ? 'Gemmer…' : 'Færdiggør opsætning'}</button>
          <a href="/">Spring over</a>
        </div>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </form>
    </main>
  );
}
