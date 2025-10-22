'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Counts = {
  totalPosts: number;
  postsThisMonth: number;
  aiTextThisMonth: number;
  aiPhotoThisMonth: number;
};

export function useCounts() {
  const [counts, setCounts] = useState<Counts>({
    totalPosts: 0,
    postsThisMonth: 0,
    aiTextThisMonth: 0,
    aiPhotoThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const startISO = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) { setErr('Ikke logget ind.'); return; }

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
      setErr(null);
    } catch (e: any) {
      setErr(e.message || 'Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [startISO]);

  // Hjælper til at bump’e AI-tekst lokalt når vi henter nye forslag
  function bumpAiTextLocal(delta = 1) {
    setCounts(c => ({ ...c, aiTextThisMonth: (c.aiTextThisMonth ?? 0) + delta }));
  }

  return { counts, setCounts, loading, err, refresh, bumpAiTextLocal };
}
