// app/(app)/dashboard/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 16 }}>
      <h2 style={{ color: '#b00020', marginBottom: 8 }}>Noget gik galt i dashboard-komponenten</h2>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {error?.message || 'Ukendt fejl'}
      </p>
      {error?.digest && (
        <p style={{ color: '#666', marginTop: 8 }}>Fejlkode: {error.digest}</p>
      )}
      <button onClick={() => reset()} style={{ marginTop: 12 }}>
        Prøv igen
      </button>
    </main>
  );
}
