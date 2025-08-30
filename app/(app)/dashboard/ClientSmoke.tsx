'use client';
import { useEffect, useState } from 'react';

export default function ClientSmoke() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);

  return (
    <main style={{ padding: 16 }}>
      <h2>Dashboard</h2>
      <p>{ok ? 'Client-rendering OK ✅' : 'Initialiserer…'}</p>
      <p>Hvis du kan se denne tekst, kører klient-komponenten korrekt.</p>
      <a href="/posts">Gå til “Dine opslag”</a>
    </main>
  );
}
