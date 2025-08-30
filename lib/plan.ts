// lib/plan.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin-klient kun til serverside (bruges i API-routes)
export const admin = createClient(supabaseUrl, serviceRoleKey);

// ----- Typer & små helpers -----
export type Plan = 'free' | 'basic' | 'pro' | 'premium';
export type UsagePeriod = 'day' | 'week' | 'month' | 'none';

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

// ----- Limits (shape “any” så API kan bruge det frit) -----
export const LIMITS: any = {
  // Tekstforslag-knappen “Få 3 nye”
  aiTextSuggestions: {
    free: { period: 'week' as UsagePeriod, max: 1 }, // 1 batch/uge
    basic:{ period: 'day' as UsagePeriod, max: 3 },  // kan tweakes
    pro:  { period: 'day' as UsagePeriod, max: 3 },  // 3 batch/dag
    premium: { period: 'none' as UsagePeriod, max: Infinity }, // fair use
  },
  // Billed-ændringer (eksempel, hvis du vil vise kvoten i UI)
  photoEdits: {
    free: { period: 'week' as UsagePeriod, max: 1 },
    basic:{ period: 'week' as UsagePeriod, max: 3 },
    pro:  { period: 'day' as UsagePeriod, max: 10 },
    premium: { period: 'none' as UsagePeriod, max: Infinity },
  },
};

// Kort label til UI
export function planLabelShort(p: Plan) {
  return p === 'free' ? 'Gratis'
       : p === 'basic' ? 'Basic'
       : p === 'pro' ? 'Pro'
       : 'Premium';
}

// Når API har et Supabase access_token, kan vi udlede e-mail
export async function getUserEmailFromToken(access_token: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.getUser(access_token);
    if (error || !data?.user) return null;
    return data.user.email ?? null;
  } catch {
    return null;
  }
}

// Din simple “plan lookup” (kan senere kobles til en rigtig tabel)
export async function getUserPlan(user_email: string | null): Promise<Plan> {
  // TODO: Slå rigtig plan op i DB (fx profiles.plan)
  // Failsafe: alle uden eksplicit plan er 'free'
  if (!user_email) return 'free';
  return 'free';
}

// ----- Usage helpers -----
// Returnerer hvor meget der er brugt i indeværende periode.
// Hvis tabellen ikke findes, returnerer vi 0 (failsafe).
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
    // Forventet tabel: usage_counters(user_email, feature, period, period_start, used)
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
    // Hvis tabellen ikke findes eller anden fejl → failsafe
    return { used: 0, period_start: start.toISOString(), period_end: end.toISOString() };
  }
}

// Øger usage med 1 for feature/period. Failsafe: returnerer true selv hvis DB ikke findes endnu.
export async function bumpUsage(
  user_email: string,
  feature: string,
  period: UsagePeriod
): Promise<boolean> {
  if (period === 'none') return true; // intet at tælle

  const now = new Date();
  const start =
    period === 'day' ? startOfDay(now)
    : period === 'week' ? startOfWeek(now)
    : period === 'month' ? startOfMonth(now)
    : startOfDay(now);
  const startISO = start.toISOString();

  try {
    // 1) Find eksisterende række
    const { data: existing } = await admin
      .from('usage_counters')
      .select('id, used')
      .eq('user_email', user_email)
      .eq('feature', feature)
      .eq('period', period)
      .eq('period_start', startISO)
      .maybeSingle();

    if (!existing) {
      // 2) Opret ny række
      const { error: insErr } = await admin.from('usage_counters').insert({
        user_email,
        feature,
        period,
        period_start: startISO,
        used: 1,
      });
      if (insErr) return true; // failsafe
      return true;
    } else {
      // 3) Opdater used = used + 1
      const { error: updErr } = await admin
        .from('usage_counters')
        .update({ used: Number(existing.used || 0) + 1 })
        .eq('id', (existing as any).id);
      if (updErr) return true; // failsafe
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
