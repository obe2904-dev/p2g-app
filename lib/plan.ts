// lib/plan.ts
// Ren hjælpefil til plan/kvoter + simpel usage-tracking.
// Ingen env-keys her. Giv en Supabase *server* client ind som argument fra dine API-routes.

import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'free' | 'basic' | 'pro' | 'premium';
export type Period = 'day' | 'week' | 'month' | 'none';
export type FeatureKey = 'ai_text_suggestions' | 'photo_edits';

type Limit = { limit: number; period: Period };

// “Fair use” => brug et højt tal i praksis
const FAIR_USE = 999999;

export const LIMITS: Record<PlanTier, Record<FeatureKey, Limit>> = {
  free: {
    ai_text_suggestions: { limit: 3, period: 'week' },
    photo_edits: { limit: 1, period: 'week' },
  },
  basic: {
    // du kan justere Basic senere; sat relativt frit til at begynde med
    ai_text_suggestions: { limit: 20, period: 'day' },
    photo_edits: { limit: 5, period: 'week' },
  },
  pro: {
    ai_text_suggestions: { limit: 3, period: 'day' },
    photo_edits: { limit: 5, period: 'week' },
  },
  premium: {
    ai_text_suggestions: { limit: FAIR_USE, period: 'day' },
    photo_edits: { limit: 20, period: 'week' },
  },
};

// Hjælp: beregn periodens start (UTC) så vi kan gruppere brug
export function getPeriodStart(period: Period, now = new Date()): Date {
  const d = new Date(now);
  if (period === 'day') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  }
  if (period === 'week') {
    // Ugen starter mandag (ISO). Find mandag kl 00:00 UTC.
    const day = d.getUTCDay(); // 0=søndag..6=lørdag
    const iso = day === 0 ? 7 : day; // 1=mandag..7=søndag
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
    monday.setUTCDate(monday.getUTCDate() - (iso - 1));
    return monday;
  }
  if (period === 'month') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  }
  // 'none'
  return new Date(0);
}

// Hent plan for en bruger (du kan mappe fra din profil/Stripe senere)
// Foreløbig: fallback til 'free' hvis ikke angivet
export function getPlanTier(plan_from_profile?: string | null): PlanTier {
  if (!plan_from_profile) return 'free';
  const key = plan_from_profile.toLowerCase();
  if (key === 'basic' || key === 'pro' || key === 'premium' || key === 'free') return key;
  return 'free';
}

// Slå grænsen op
export function getLimit(plan: PlanTier, feature: FeatureKey): Limit {
  return LIMITS[plan][feature];
}

// --------- Usage-helpers (kræver server-side SupabaseClient) ----------
// Forventer tabel: plan_usage (user_email text, feature text, period text, period_start timestamptz, count int, id pk)
// Hvis du ikke har den endnu, kan vi levere SQL – men koden her kompilere/uploader fint uanset.

type UsageRow = {
  id: number;
  user_email: string;
  feature: string;
  period: string;
  period_start: string; // ISO
  count: number;
};

export async function getUsageCount(
  admin: SupabaseClient,
  user_email: string,
  feature: FeatureKey,
  period: Period,
  period_start: Date
): Promise<number> {
  const iso = period_start.toISOString();
  const { data, error } = await admin
    .from('plan_usage')
    .select('id,count')
    .eq('user_email', user_email)
    .eq('feature', feature)
    .eq('period', period)
    .eq('period_start', iso);

  if (error) throw new Error(error.message);
  const row = (data as any[] | null)?.[0] as UsageRow | undefined;
  return row ? Number(row.count) || 0 : 0;
}

export async function incrementUsage(
  admin: SupabaseClient,
  user_email: string,
  feature: FeatureKey,
  period: Period,
  period_start: Date,
  by = 1
): Promise<number> {
  const iso = period_start.toISOString();

  // Slå evt. eksisterende række op
  const { data: existingData, error: selErr } = await admin
    .from('plan_usage')
    .select('id,count')
    .eq('user_email', user_email)
    .eq('feature', feature)
    .eq('period', period)
    .eq('period_start', iso);

  if (selErr) throw new Error(selErr.message);

  const row = (existingData as any[] | null)?.[0] as UsageRow | undefined;

  if (row) {
    const next = (Number(row.count) || 0) + by;
    const { error: updErr } = await admin
      .from('plan_usage')
      .update({ count: next })
      .eq('id', row.id);
    if (updErr) throw new Error(updErr.message);
    return next;
  } else {
    const { error: insErr } = await admin
      .from('plan_usage')
      .insert({
        user_email,
        feature,
        period,
        period_start: iso,
        count: by,
      });
    if (insErr) throw new Error(insErr.message);
    return by;
  }
}

// Kombi: tjek kvote + (valgfrit) increment
export async function checkQuotaAndMaybeIncrement(
  admin: SupabaseClient,
  opts: {
    user_email: string;
    plan: PlanTier;
    feature: FeatureKey;
    increment?: boolean; // true = forbrug ét “tick”, hvis der er plads
    now?: Date;
  }
): Promise<{ ok: boolean; used: number; limit: number; remaining: number; reason?: string }> {
  const { user_email, plan, feature, increment = true, now } = opts;
  const { limit, period } = getLimit(plan, feature);

  if (period === 'none' || limit >= FAIR_USE) {
    // Ingen reel grænse
    if (increment) {
      // vi kan stadig vælge at tracke – springer over for “fair use”
    }
    return { ok: true, used: 0, limit, remaining: limit };
  }

  const start = getPeriodStart(period, now);
  const used = await getUsageCount(admin, user_email, feature, period, start);

  if (used >= limit) {
    return { ok: false, used, limit, remaining: 0, reason: 'quota_exceeded' };
  }

  if (increment) {
    const after = await incrementUsage(admin, user_email, feature, period, start, 1);
    return { ok: true, used: after, limit, remaining: Math.max(0, limit - after) };
  } else {
    return { ok: true, used, limit, remaining: Math.max(0, limit - used) };
  }
}
