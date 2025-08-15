export default function PricingPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>Vælg en plan, der passer til din café</h2>
      <p style={{ color: '#555', marginBottom: 24 }}>Start gratis. Opgrader når du vil – ingen binding.</p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Free */}
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h3>Gratis</h3>
          <p style={{ minHeight: 48 }}>Kom i gang: 3 idéer + 3 tekstforslag/måned, kalender‑preview (3 begivenheder), billedtjek (basis), 1 autopost/uge til 1 kanal, performance (7 dage).</p>
          <a href="/signup" style={{ display: 'inline-block', marginTop: 8 }}>Start gratis</a>
        </div>

        {/* Basic */}
        <div style={{ border: '2px solid #000', borderRadius: 12, padding: 16 }}>
          <h3>Basic</h3>
          <p style={{ minHeight: 48 }}>Hverdag gjort let: ubegrænsede idéer/tekster (lette), fuld kalender, billedtjek (udvidet), manuel publicering (copy‑paste), performance (30 dage) m. bedste tidspunkt/format.</p>
          <a href="/signup" style={{ display: 'inline-block', marginTop: 8 }}>Kom i gang</a>
        </div>

        {/* Pro */}
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h3>Pro</h3>
          <p style={{ minHeight: 48 }}>Alt i Basic + autopublicering til flere kanaler, avancerede indsigter, idébank & lokale events/trends, SEO‑basics, planlægning.</p>
          <a href="/signup" style={{ display: 'inline-block', marginTop: 8 }}>Prøv Pro</a>
        </div>

        {/* Premium */}
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h3>Premium</h3>
          <p style={{ minHeight: 48 }}>Alt i Pro + ugentlige AI‑udkast (autopilot), AI‑inbox (svartips), e‑mail af bedste opslag, annonce‑forslag.</p>
          <a href="/signup" style={{ display: 'inline-block', marginTop: 8 }}>Kontakt os</a>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h4>FAQ</h4>
        <details>
          <summary>Virker det til både Facebook og Instagram?</summary>
          <p>Ja. I Basic copy‑paster du selv. I Pro/Premium kan du tilkoble autopublicering.</p>
        </details>
        <details>
          <summary>Hvad kræver Instagram‑posting?</summary>
          <p>En Business/Professional‑konto koblet til en Facebook‑side (gælder for Pro/Premium).</p>
        </details>
        <details>
          <summary>Kan jeg skifte plan?</summary>
          <p>Ja, når som helst.</p>
        </details>
      </section>
    </main>
  );
}
