'use client';
import Link from 'next/link';
import Card, { cardTitle, bigNumber, subText } from './Card';

export type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

export default function HeroRow({
  counts,
  loading,
  orgName,
  city,
  website,
}: {
  counts: Counts;
  loading: boolean;
  orgName: string;
  city: string;
  website: string;
}) {
  const aiTotal = (counts.aiTextThisMonth ?? 0) + (counts.aiPhotoThisMonth ?? 0);

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: '1fr 1fr 2fr',
        alignItems: 'stretch',
      }}
    >
      {/* Kort 1: Opslag denne måned */}
      <Card>
        <div style={cardTitle}>Opslag denne måned</div>
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

      {/* Kort 2: AI denne måned */}
      <Card>
        <div style={cardTitle}>AI denne måned</div>
        <div style={bigNumber}>
          {loading ? '—' : aiTotal.toLocaleString('da-DK')}
        </div>
        <div style={subText}>
          Tekst:{' '}
          <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
          <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
        </div>
      </Card>

      {/* Kort 3: Virksomhedsprofil */}
      <Card style={{ display: 'grid', gap: 6 }}>
        <div style={cardTitle}>Virksomhedsprofil</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          {orgName || 'Din virksomhed'}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          {city ? `By: ${city}` : 'By: —'}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          Hjemmeside:{' '}
          {website ? (
            <a href={website} target="_blank" rel="noreferrer">
              {website}
            </a>
          ) : (
            '—'
          )}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>
          Kanaler: Facebook · Instagram
        </div>
        <div style={{ marginTop: 6 }}>
          <Link
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
          </Link>
        </div>
      </Card>
    </section>
  );
}
