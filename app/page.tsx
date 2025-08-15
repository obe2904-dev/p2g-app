'use client';
export default function HomePage() {
  function openSignup() {
    window.dispatchEvent(new CustomEvent('open-auth', { detail: { mode: 'signup' } }));
  }
  return (
    <section style={{ padding: '40px 0' }}>
      <h1>Flere gæster med 5-minutters opslag. <br />Post2Grow til caféer.</h1>
      <p>Få idéer, tekstforslag og billedtjek. Se hvad der virker – uden at bruge en hel formiddag.</p>
      <div style={{ display:'flex', gap:12, marginTop:12 }}>
        <button onClick={openSignup} style={{ padding:'10px 14px', border:'1px solid #000', borderRadius:8 }}>
          Opret gratis konto
        </button>
        <a href="/pricing">Priser</a>
      </div>
    </section>
  );
}
