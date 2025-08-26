import Card from './Card';

// Lokale typer (hold dem her for enkelhed)
type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

type OrgSnapshot = {
  orgName: string;
  city: string;
  website: string;
};

export default function HeroRow({
  counts,
  loading,
  org,
}: {
  counts: Counts;
  loading: boolean;
  org: OrgSnapshot;   // ← matcher nu page.tsx: org={org}
}) {
  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: '1fr 1fr 2fr',
        alignItems: 'stretch',
      }}
    >
      {/* Kort 1 */}
      <Card title="Opslag denne måned">
        <div style={bigNumber}>
          {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
        </div>
        <div style={subText}>
          I alt:{' '}
          <strong>
            {loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}
          </strong>
        </div>
      </Card>

      {/* Kort 2 */}
      <Card title="AI denne måned">
        <div style={bigNumber}>
          {loading ? '—' : aiTotal.toLocaleString('da-DK')}
        </div>
        <div style={subText}>
          Tekst:{' '}
          <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
          <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
        </div>
      </Card>

      {/* Kort 3 */}
      <Card title="Virksomhedsprofil">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          {org.orgName || 'Din virksomhed'}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          {org.city ? `By: ${org.city}` : 'By: —'}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          Hjemmeside:{' '}
          {org.website ? (
            <a href={org.website} target="_blank" rel="noreferrer">
              {org.website}
            </a>
          ) : (
            '—'
          )}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>Kanaler: Facebook · Instagram</div>
        <div style={{ marginTop: 6 }}>
          <a
            href="/brand"
            style={{
              display: 'inline-block',
              fontSize: 12,
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '4px 10px',
              background: '#fafafa',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            Se profil →
          </a>
        </div>
      </Card>
    </section>
  );
}

const bigNumber: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.1,
  marginBottom: 6,
};

const subText: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
};
