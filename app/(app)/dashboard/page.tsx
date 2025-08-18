// app/(app)/dashboard/page.tsx
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Dashboard</h2>
      <p style={{ color: '#555' }}>Her kommer dit overblik.</p>
    </div>
  );
}
