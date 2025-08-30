// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server/admin-klient (bruges i API routes – ikke i client-komponenter)
export const admin = createClient(supabaseUrl, serviceRoleKey);

// ----- Typer -----
export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

// ----- Dato-hjælpere -----
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const dow = x.getDay();           // 0 = søndag
  const diff = (dow + 6) % 7;       // mandag som uge-start
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

// ----- Auth/plan -----
export async function getUserEmailFromToken(access_token: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

// Stub: alle uden eksplicit plan er 'free' (kan kobles til DB senere)
export async function getUserPlan(user_email: string | null): Promise<Plan> {
  if (!user_email) return 'free';
  return 'free';
}

// ----- Usage (tællere) -----
// Returnerer KUN tallet for brug i den aktuelle periode.
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
    : period === 'month' ? startOfMonth(now)
    : startOfDay(new Date(0));
  const end = addPeriod(start, period);

  try {
    const { data } = await admin
      .from('usage_counters')
      .select('used, period_start')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .gte('period_start', start.toISOString())
      .lt('period_start', end.toISOString())
      .maybeSingle();

    return Number((data as any)?.used ?? 0);
  } catch {
    return 0; // failsafe hvis tabel ikke findes
  }
}

// Øger tæller med 1 i nuværende periode (failsafe: returnerer true uanset)
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
      await admin.from('usage_counters').insert({
        user_email,
        feature,
        period,
        period_start: startISO,
        used: 1,
      });
      return true;
    } else {
      await admin
        .from('usage_counters')
        .update({ used: Number((existing as any).used ?? 0) + 1 })
        .eq('id', (existing as any).id);
      return true;
    }
  } catch {
    return true; // failsafe
  }
}

// Hvornår nulstilles perioden næste gang? (ISO)
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
