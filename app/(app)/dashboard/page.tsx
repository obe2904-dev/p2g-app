// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;       // nu: kun UDGIVET i alt
  postsThisMonth: number;   // nu: kun UDGIVET denne måned
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) { setErr('Ikke logget ind.'); return; }

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const startISO = monthStart.toISOString();

        // UDGIVET i alt
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        // UDGIVET denne måned
        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        // AI-forbrug – tekst (denne måned)
        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

        // AI-forbrug – foto (denne måned)
        const { count: aiPhotoThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'photo')
          .gte('used_at', startISO);

        setCounts({
          totalPosts: totalPosts ?? 0,
          postsThisMonth: postsThisMonth ?? 0,
          aiTextThisMonth: aiTextThisMonth ?? 0,
          aiPhotoThisMonth: aiPhotoThisMonth ?? 0,
        });
      } catch (e: any) {
        setErr(e.message || 'Kunne ikke hente data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aiTotal = counts.aiTextThisMonth + counts.aiPhotoThisMonth;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Øverste kort – responsivt grid */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {/* Kort 1: Opslag denne måned (kun Udgivet) */}
        <div style={cardStyle}>
          <div style={cardTitle}>Opslag denne måned</div>
          <div style={bigNumber}>
            {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div style={subText}>
            I alt:{' '}
            <strong>{loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2: AI denne måned */}
        <div style={cardStyle}>
          <div style={cardTitle}>AI denne måned</div>
          <div style={bigNumber}>{loading ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div style={subText}>
            Tekst: <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>
      </section>

      {err && <p style={{ color: '#b00' }}>{err}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const cardTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  marginBottom: 6,
};

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
