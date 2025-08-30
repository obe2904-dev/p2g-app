// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin-klient (server-side)
export const admin = createClient(supabaseUrl, serviceRoleKey);

// Typer
export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

// ---------- Tids-hjælpere ----------
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = søn
  const diff = (dow + 6) % 7; // mandag start
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addPeriod(from: Date, period: UsagePeriod) {
  const d = new Date(from);
  if (period === 'day') d.setDate(d.getDate() + 1);
  else if (period === 'week') d.setDate(d.getDate() + 7);
  else if (period === 'month') d.setMonth(d.getMonth() + 1);
  return d;
}

// ---------- Limits (pr. feature pr. plan) ----------
export const LIMITS = {
  text_suggestions: {
    free:    { period: 'week'  as UsagePeriod, max: 3 },
    basic:   { period: 'day'   as UsagePeriod, max: Infinity }, // ubegrænset (copy/paste-setup)
    pro:     { period: 'day'   as UsagePeriod, max: 3 },
    premium: { period: 'day'   as UsagePeriod, max: Infinity }, // “fair use”
  },
  photo_edits: {
    free:    { period: 'week'  as UsagePeriod, max: 1 },
    basic:   { period: 'week'  as UsagePeriod, max: 3 },
    pro:     { period: 'day'   as UsagePeriod, max: 10 },
    premium: { period: 'none'  as UsagePeriod, max: Infinity },
  },
} as const;

export function planLabelShort(p: Plan) {
  return p === 'free' ? 'Gratis'
       : p === 'basic' ? 'Basic'
       : p === 'pro' ? 'Pro'
       : 'Premium';
}

// ---------- Auth & plan ----------
export async function getUserEmailFromToken(access_token: string | null): Promise<string | null> {
  try {
    if (!access_token) return null;
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

// Midlertidig: alle er 'free', indtil vi kobler rigtig plan på profiles/tabel
export async function getUserPlan(_user_email: string | null): Promise<Plan> {
  return 'free';
}

// ---------- Usage (tællere) ----------
// Returnerer et TAL (antal brugt i aktiv periode)
export async function getUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<number> {
  try {
    if (period === 'none') return 0;

    const now = new Date();
    const start =
      period === 'day' ? startOfDay(now)
      : period === 'week' ? startOfWeek(now)
      : period === 'month' ? startOfMonth(now)
      : startOfDay(now);
    const end = addPeriod(start, period);

    // Hent alle rækker i perioden og summer "used"
    const { data, error } = await admin
      .from('usage_counters')
      .select('used, period_start')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .gte('period_start', start.toISOString())
      .lt('period_start', end.toISOString());

    if (error || !data) return 0;
    return (data as any[]).reduce((sum, r: any) => sum + Number(r.used || 0), 0);
  } catch {
    // failsafe: ingen blokeringer ved fejl
    return 0;
  }
}

export async function bumpUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<void> {
  try {
    if (period === 'none') return;

    const now = new Date();
    const start =
      period === 'day' ? startOfDay(now)
      : period === 'week' ? startOfWeek(now)
      : period === 'month' ? startOfMonth(now)
      : startOfDay(now);
    const startISO = start.toISOString();

    // Find eksisterende række for perioden
    const { data: existing } = await admin
      .from('usage_counters')
      .select('id, used')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .eq('period_start', startISO)
      .maybeSingle();

    if (!existing) {
      await admin.from('usage_counters').insert({
        user_email, feature, period, period_start: startISO, used: 1,
      });
    } else {
      await admin
        .from('usage_counters')
        .update({ used: Number((existing as any).used || 0) + 1 })
        .eq('id', (existing as any).id);
    }
  } catch {
    // failsafe: ignorer
  }
}

export function nextResetAtISO(period: UsagePeriod): string {
  if (period === 'none') return '';
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
    : period === 'week' ? startOfWeek(now)
    : startOfMonth(now);
  const next = addPeriod(start, period);
  return next.toISOString();
}
