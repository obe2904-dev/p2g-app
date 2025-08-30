import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

// Plan-limits (null = ubegrænset/fair use)
type Limit = { period: 'daily'|'weekly'|'monthly', limit: number|null };
type LimitsByPlan = Record<string, { text_three_new: Limit; photo_ai_edit: Limit }>;

export const LIMITS: LimitsByPlan = {
  free: {
    text_three_new: { period: 'weekly', limit: 3 },  // 3 nye pr. uge
    photo_ai_edit: { period: 'weekly', limit: 1 },   // 1 AI-foto pr. uge
  },
  basic: {
    text_three_new: { period: 'daily', limit: null }, // ubegrænset (lette tekster)
    photo_ai_edit: { period: 'weekly', limit: 0 },    // ikke inkluderet i Basic
  },
  pro: {
    text_three_new: { period: 'daily', limit: 3 },    // 3 nye pr. dag
    photo_ai_edit: { period: 'weekly', limit: null }, // ubegrænset
  },
  premium: {
    text_three_new: { period: 'daily', limit: null }, // ubegrænset (fair use)
    photo_ai_edit: { period: 'weekly', limit: null }, // ubegrænset
  },
};

export async function getUserEmailFromToken(authorizationHeader?: string|null) {
  const auth = authorizationHeader || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email!;
}

export async function getUserPlan(user_email: string): Promise<keyof LimitsByPlan> {
  const { data, error } = await admin
    .from('profiles_app')
    .select('plan')
    .eq('user_email', user_email)
    .single();
  if (error || !data?.plan) return 'free';
  const p = String(data.plan).toLowerCase();
  return (p === 'basic' || p === 'pro' || p === 'premium') ? (p as any) : 'free';
}

// DK-lokal dato (YYYY-MM-DD) for nu
function dkLocalDateStr(d = new Date()) {
  const s = d.toLocaleString('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }); // YYYY-MM-DD
  return s;
}

function startOfWeekDK(d = new Date()) {
  const tz = 'Europe/Copenhagen';
  const now = new Date(new Date(d).toLocaleString('en-US', { timeZone: tz }));
  const day = now.getDay();                // 0=Sun, 1=Mon
  const diffToMon = (day + 6) % 7;         // Monday as 0
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMon);
  return dkLocalDateStr(start);
}

export function currentPeriodStart(period: 'daily'|'weekly'|'monthly') {
  if (period === 'daily') return dkLocalDateStr();
  if (period === 'weekly') return startOfWeekDK();
  // monthly
  const tz = 'Europe/Copenhagen';
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth()+1).padStart(2,'0');
  const d = '01';
  return `${y}-${m}-${d}`;
}

export function nextResetAtISO(period: 'daily'|'weekly'|'monthly') {
  const tz = 'Europe/Copenhagen';
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

  if (period === 'daily') {
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0,0,0,0);
    return new Date(next.toLocaleString('en-US',{ timeZone: tz })).toISOString();
  }
  if (period === 'weekly') {
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const nextMon = new Date(now);
    nextMon.setDate(now.getDate() - diffToMon + 7);
    nextMon.setHours(0,0,0,0);
    return new Date(nextMon.toLocaleString('en-US',{ timeZone: tz })).toISOString();
  }
  // monthly
  const next = new Date(now);
  next.setUTCMonth(next.getUTCMonth()+1, 1);
  next.setUTCHours(0,0,0,0);
  return next.toISOString();
}

export async function getUsage(user_email: string, feature: string, period: 'daily'|'weekly'|'monthly') {
  const period_start = currentPeriodStart(period);
  const { data, error } = await admin
    .from('usage_counters')
    .select('used')
    .eq('user_email', user_email)
    .eq('feature', feature)
    .eq('period', period)
    .eq('period_start', period_start)
    .single();
  return error || !data ? 0 : Number(data.used || 0);
}

export async function bumpUsage(user_email: string, feature: string, period: 'daily'|'weekly'|'monthly') {
  const period_start = currentPeriodStart(period);
  // Upsert (insert on conflict)
  const { error } = await admin
    .from('usage_counters')
    .upsert({ user_email, feature, period, period_start, used: 1 }, { onConflict: 'user_email,feature,period,period_start' });
  if (error) throw new Error(error.message);
  // increment if already existed
  const { error: incErr } = await admin.rpc('increment_usage', {
  p_user_email: user_email,
  p_feature: feature,
  p_period: period,
  p_period_start: period_start,
});

// Hvis SQL-funktionen endnu ikke er deployet (typisk kode "42883": undefined function),
// så springer vi pænt videre. Andre fejl bobler vi op.
if (incErr && incErr.code !== '42883') {
  throw new Error(incErr.message);
}
  // fallback safe increment via update
  await admin
    .from('usage_counters')
    .update({ used: admin.rpc as any }) // ignored by supabase-js; we'll do a manual increment below
    .eq('user_email', user_email)
    .eq('feature', feature)
    .eq('period', period)
    .eq('period_start', period_start);

  // manual atomic-ish increment
  await admin.from('usage_counters')
    .update({ used: (await getUsage(user_email, feature, period)) + 1 })
    .eq('user_email', user_email)
    .eq('feature', feature)
    .eq('period', period)
    .eq('period_start', period_start);
}

export function planLabelShort(plan: string) {
  if (plan === 'premium') return 'Premium';
  if (plan === 'pro') return 'Pro';
  if (plan === 'basic') return 'Basic';
  return 'Gratis';
}
