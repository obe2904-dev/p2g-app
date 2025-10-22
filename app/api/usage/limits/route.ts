import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

function currentPeriodUTC() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET() {
  // Supabase klient som læser session fra cookies
  const supabase = createRouteHandlerClient({ cookies });

  // Kræv login (ellers 401)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const period = currentPeriodUTC();

  const { data, error } = await supabase
    .from('usage_counters')
    .select('key, used, limit')
    .eq('user_id', user.id)
    .eq('period', period);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const usage: Record<string, { used: number, limit: number | null }> = {};
  for (const r of data || []) usage[r.key] = { used: r.used ?? 0, limit: r.limit ?? null };

  return NextResponse.json({ period, usage });
}
