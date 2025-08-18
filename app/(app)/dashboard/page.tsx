// app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type Counts = {
  totalPosts: number;
  postsThisMonth: number;
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

        // KUN publicerede opslag i tællingerne
        const { count: totalPosts } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published');

        const { count: postsThisMonth } = await supabase
          .from('posts_app')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('status', 'published')
          .gte('created_at', startISO);

        const { count: aiTextThisMonth } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_email', email)
          .eq('kind', 'text')
          .gte('used_at', startISO);

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
    <div className="wrap">
      <section className="dashRow">
        {/* Kort 1: Opslag denne måned (venstre) */}
        <div className="card">
          <div className="card-title">Opslag denne måned</div>
          <div className="card-big">
            {loading ? '—' : counts.postsThisMonth.toLocaleString('da-DK')}
          </div>
          <div className="card-sub">
            I alt:{' '}
            <strong>{loading ? '—' : counts.totalPosts.toLocaleString('da-DK')}</strong>
          </div>
        </div>

        {/* Kort 2: AI denne måned (midt) */}
        <div className="card">
          <div className="card-title">AI denne måned</div>
          <div className="card-big">{loading ? '—' : aiTotal.toLocaleString('da-DK')}</div>
          <div className="card-sub">
            Tekst: <strong>{loading ? '—' : counts.aiTextThisMonth}</strong> · Foto:{' '}
            <strong>{loading ? '—' : counts.aiPhotoThisMonth}</strong>
          </div>
        </div>

        {/* Kort 3: Dobbelt bredde (højre) – placeholder */}
        <div className="card card-large">
          {/* Tomt for nu – klar til diagram/indsigt senere */}
        </div>
      </section>

      {err && <p style={{ color: '#b00' }}>{err}</p>}

      <style jsx>{`
        /* Layout-ramme */
        .wrap { display: grid; gap: 16px; }

        /* Én række, tre kolonner: 1fr, 1fr, 2fr */
        .dashRow {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr 2fr;
          align-items: stretch;
        }

        /* Min-bredder på de to små kort, så de ikke presses for meget */
        .dashRow > .card:nth-child(1),
        .dashRow > .card:nth-child(2) {
          min-width: 260px;
        }
        /* Større minimum på det brede kort */
        .dashRow > .card-large {
          min-width: 360px;
          min-height: 120px;
        }

        /* Kort-styles */
        .card {
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 16px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .card-title {
          font-size: 12px;
          color: #666;
          margin-bottom: 6px;
        }
        .card-big {
          font-size: clamp(22px, 3.2vw, 28px);
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: 6px;
        }
        .card-sub {
          font-size: clamp(12px, 1.4vw, 13px);
          color: #555;
        }

        /* Responsiv opførsel: to kolonner (smalle skærme) */
        @media (max-width: 1100px) {
          .dashRow {
            grid-template-columns: minmax(240px, 1fr) minmax(240px, 1fr);
          }
          .dashRow > .card-large {
            grid-column: 1 / -1; /* brede kort går på ny linje */
          }
        }

        /* Én kolonne på meget smalle skærme */
        @media (max-width: 560px) {
          .dashRow { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
