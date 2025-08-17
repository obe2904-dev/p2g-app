// app/(app)/page.tsx

// (Valgfrit) undgå gammel prerender-cache når vi ændrer hurtigt
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  // Bevidst tom for nu — vi tilføjer kort i Step D-2
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* TODO: Her kommer dashboard-kortene i næste step (AI-forbrug, Seneste opslag, m.m.) */}
    </div>
  );
}
