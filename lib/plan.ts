// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side admin klient (må KUN bruges i API routes/server)
export const admin = createClient(supabaseUrl, serviceRoleKey);

export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

// Kvoter (feature -> plan -> {period, max})
export const LIMITS = {
  // Bruges af knappen "Få 3 nye" (tekstforslag)
  text_suggestions: {
    free:    { period: 'week' as UsagePeriod,  max: 1 },        // 1 batch/uge
    basic:   { period: 'day'  as UsagePeriod,  max: Infinity }, // ubegrænset (copy/paste-setup)
    pro:     { period: 'day'  as UsagePeriod,  max: 1 },        // 1 batch/dag
    premium: { period: 'none' as UsagePeriod,  max: Infinity }, // fair use
  },
  // Eksempel (vises i UI): billedændringer/forbedringer
  photo_edits: {
    free:    { period: 'week' as UsagePeriod,  max: 1 },
    basic:   { period: 'week' as UsagePeriod,  max: 3 },
    pro:     { period: 'day'  as UsagePeriod,  max: 10 },
    premium: { period: 'none' as UsagePeriod,  max: Infinity },
  },
} as const;

// Kort label
export function planLabelShort(p: Plan) {
  return p === 'free' ? 'Gratis'
       : p === 'basic' ? 'Basic'
       : p === 'pro' ? 'Pro'
       : 'Premium';
}

// ----- Auth/plan helpers -----

// Udleder e-mail fra Supabase access_token
export async function getUserEmailFromToken(access_token: string): Promise<string | null> {
  try {
    if (!access_token) return null;
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

// Simpel plan-lookup (kan kobles på DB senere)
export async function getUserPlan(user_email: string | null): Promise<Plan> {
  if (!user_email) return 'free';
  // TODO: slå rigtig plan op (fx i profiles)
  return 'free';
}

// ----- Usage helpers -----

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = søn
  const diff = (dow + 6) % 7; // mandag som uge-start
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

// Returnerer brug i nuværende periode
export async function getUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<{ used: number; period_start: string; period_end: string }> {
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
    : period === 'week' ? startOfWeek(now)
    : period === 'month' ? startOfMonth(now)
    : startOfDay(new Date(0));
  const end = addPeriod(start, period === 'none' ? 'day' : period);

  try {
    // Tabel: usage_counters(user_email, feature, period, period_start, used)
    const { data, error } = await admin
      .from('usage_counters')
      .select('used, period_start')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .gte('period_start', start.toISOString())
      .lt('period_start', end.toISOString())
      .maybeSingle();

    if (error || !data) {
      return { used: 0, period_start: start.toISOString(), period_end: end.toISOString() };
    }
    return { used: Number(data.used || 0), period_start: start.toISOString(), period_end: end.toISOString() };
  } catch {
    return { used: 0, period_start: start.toISOString(), period_end: end.toISOString() };
  }
}

// Øger usage med 1 i nuværende periode (failsafe: returnerer true selv ved DB-fejl)
export async function bumpUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<boolean> {
  if (period === 'none') return true;

  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
    : period === 'week' ? startOfWeek(now)
    : period === 'month' ? startOfMonth(now)
    : startOfDay(now);
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
        user_email,
        feature,
        period,
        period_start: startISO,
        used: 1,
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

// Hvornår nulstilles tælleren?
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
