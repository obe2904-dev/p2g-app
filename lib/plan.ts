// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin-klient (server only)
export const admin = createClient(supabaseUrl, serviceRoleKey);

// -------- Limits (hold det simpelt & konsistent) --------
export const LIMITS = {
  // Bruges af “Få 3 nye” tekstforslag
  text_suggestions: {
    free:    { period: 'week' as UsagePeriod, max: 1 },
    basic:   { period: 'day'  as UsagePeriod, max: 3 },
    pro:     { period: 'day'  as UsagePeriod, max: 3 },
    premium: { period: 'none' as UsagePeriod, max: Infinity }, // fair use
  },
  // Kan bruges til fremtidige billedændringer
  photo_edits: {
    free:    { period: 'week' as UsagePeriod, max: 1 },
    basic:   { period: 'week' as UsagePeriod, max: 3 },
    pro:     { period: 'day'  as UsagePeriod, max: 10 },
    premium: { period: 'none' as UsagePeriod, max: Infinity },
  },
} as const;

export function planLabelShort(p: Plan) {
  return p === 'free' ? 'Gratis'
       : p === 'basic' ? 'Basic'
       : p === 'pro' ? 'Pro'
       : 'Premium';
}

// -------- Auth/plan helpers --------
export async function getUserEmailFromToken(access_token: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

// TODO: slå rigtig plan op i DB. Indtil da: fallback = 'free'
export async function getUserPlan(user_email: string | null): Promise<Plan> {
  if (!user_email) return 'free';
  return 'free';
}

// -------- Period helpers --------
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); const dow = x.getDay(); const diff = (dow+6)%7; x.setDate(x.getDate()-diff); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addPeriod(from: Date, period: UsagePeriod) {
  const d = new Date(from);
  if (period === 'day') d.setDate(d.getDate()+1);
  else if (period === 'week') d.setDate(d.getDate()+7);
  else if (period === 'month') d.setMonth(d.getMonth()+1);
  return d;
}

export function nextResetAtISO(period: UsagePeriod): string {
  if (period === 'none') return '';
  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
  : period === 'week' ? startOfWeek(now)
  : startOfMonth(now);
  return addPeriod(start, period).toISOString();
}

// -------- Usage (failsafe: virker selv uden tabel) --------
// Returnerer ANTAL brugt i indeværende periode
export async function getUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<number> {
  if (period === 'none') return 0;

  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
  : period === 'week' ? startOfWeek(now)
  : startOfMonth(now);
  const end = addPeriod(start, period);

  try {
    const { data, error } = await admin
      .from('usage_counters')
      .select('used, period_start')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .gte('period_start', start.toISOString())
      .lt('period_start', end.toISOString())
      .maybeSingle();

    if (error || !data) return 0;
    return Number(data.used || 0);
  } catch {
    return 0;
  }
}

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
  : startOfMonth(now);
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
        user_email, feature, period, period_start: startISO, used: 1
      });
      if (insErr) return true; // failsafe
      return true;
    } else {
      const { error: updErr } = await admin
        .from('usage_counters')
        .update({ used: Number((existing as any).used || 0) + 1 })
        .eq('id', (existing as any).id);
      if (updErr) return true; // failsafe
      return true;
    }
  } catch {
    return true;
  }
}
