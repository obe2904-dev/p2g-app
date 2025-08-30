// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin-klient KUN server-side (API routes)
export const admin = createClient(supabaseUrl, serviceRoleKey);

// ----- Typer & helpers -----
export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); const dow = x.getDay(); const diff = (dow + 6) % 7; x.setDate(x.getDate() - diff); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addPeriod(from: Date, period: UsagePeriod) {
  const d = new Date(from);
  if (period === 'day') d.setDate(d.getDate() + 1);
  else if (period === 'week') d.setDate(d.getDate() + 7);
  else if (period === 'month') d.setMonth(d.getMonth() + 1);
  return d;
}

// ----- Limits (keyed by "feature" -> plan) -----
export const LIMITS = {
  text_suggestions: {
    free:    { period: 'week'  as UsagePeriod, max: 1 }, // 1 batch/uge
    basic:   { period: 'day'   as UsagePeriod, max: Infinity }, // ubegrænset i Basic (manuel)
    pro:     { period: 'day'   as UsagePeriod, max: 3 }, // 3 batch/dag
    premium: { period: 'none'  as UsagePeriod, max: Infinity }, // fair use
  },
  photo_edits: {
    free:    { period: 'week'  as UsagePeriod, max: 1 },
    basic:   { period: 'week'  as UsagePeriod, max: 3 },
    pro:     { period: 'day'   as UsagePeriod, max: 10 },
    premium: { period: 'none'  as UsagePeriod, max: Infinity },
  },
} as const;

export function planLabelShort(p: Plan) {
  return p === 'free' ? 'Gratis' : p === 'basic' ? 'Basic' : p === 'pro' ? 'Pro' : 'Premium';
}

// ----- User & plan -----
export async function getUserEmailFromToken(access_token: string): Promise<string | null> {
  if (!access_token) return null;
  try {
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch { return null; }
}

// TODO: slå rigtig plan op i DB; fallback = free
export async function getUserPlan(user_email: string | null): Promise<Plan> {
  if (!user_email) return 'free';
  return 'free';
}

// ----- Usage (robust og konsistent) -----
// Returnerer antal brugt i aktuel periode (tal).
export async function getUsage(
  user_email: string,
  feature: keyof typeof LIMITS,
  period: UsagePeriod
): Promise<number> {
  if (period === 'none') return 0;
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now) :
    period === 'week' ? startOfWeek(now) :
    startOfMonth(now);
  const end = addPeriod(start, period);

  try {
    // Hent evt. rækker i vinduet og summer
    const { data, error } = await admin
      .from('usage_counters')
      .select('used, period_start')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .gte('period_start', start.toISOString())
      .lt('period_start', end.toISOString());

    if (error || !data) return 0;
    return (data as any[]).reduce((sum, r) => sum + Number(r.used || 0), 0);
  } catch {
    return 0; // failsafe, hvis tabel mangler
  }
}

// Øg usage med 1 (ignorér fejl → failsafe true)
export async function bumpUsage(
  user_email: string,
  feature: keyof typeof LIMITS,
  period: UsagePeriod
): Promise<boolean> {
  if (period === 'none') return true;
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now) :
    period === 'week' ? startOfWeek(now) :
    startOfMonth(now);
  const startISO = start.toISOString();

  try {
    const { data: existing } = await admin
      .from('usage_counters')
      .select('id, used')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .eq('period_start', startISO)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await admin.from('usage_counters').insert({
        user_email, feature, period, period_start: startISO, used: 1,
      });
      if (insErr) return true;
      return true;
    } else {
      const { error: updErr } = await admin
        .from('usage_counters')
        .update({ used: Number((existing as any).used || 0) + 1 })
        .eq('id', (existing as any).id);
      if (updErr) return true;
      return true;
    }
  } catch {
    return true;
  }
}

// Hvornår nulstilles perioden næste gang? (ISO)
export function nextResetAtISO(period: UsagePeriod): string {
  if (period === 'none') return '';
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now) :
    period === 'week' ? startOfWeek(now) :
    startOfMonth(now);
  return addPeriod(start, period).toISOString();
}
