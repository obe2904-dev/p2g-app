// lib/planLimits.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

export type PlanLimits = {
  plan_id: 'free' | 'basic' | 'pro' | 'premium' | string;
  ai_text_month: number | null;
  ai_image_month: number | null;
  max_drafts: number | null;
  brand_auto_pages: number;
  brand_manual_extra: number;
  brand_manual_refresh_per_month: number;
  brand_auto_refresh: boolean;
  calendar_level: 'none' | 'mini' | 'full';
  kpi_window_days: number;
  autopost_enabled: boolean;
};

const FALLBACK: Record<string, PlanLimits> = {
  free:    { plan_id:'free',    ai_text_month:3,   ai_image_month:3,   max_drafts:20, brand_auto_pages:4, brand_manual_extra:2,  brand_manual_refresh_per_month:0, brand_auto_refresh:false, calendar_level:'mini', kpi_window_days:0,   autopost_enabled:false },
  basic:   { plan_id:'basic',   ai_text_month:null,ai_image_month:50,  max_drafts:null,brand_auto_pages:4, brand_manual_extra:4,  brand_manual_refresh_per_month:1, brand_auto_refresh:false, calendar_level:'full', kpi_window_days:30,  autopost_enabled:false },
  pro:     { plan_id:'pro',     ai_text_month:null,ai_image_month:200, max_drafts:null,brand_auto_pages:8, brand_manual_extra:8,  brand_manual_refresh_per_month:4, brand_auto_refresh:true,  calendar_level:'full', kpi_window_days:90,  autopost_enabled:true  },
  premium: { plan_id:'premium', ai_text_month:null,ai_image_month:null,max_drafts:null,brand_auto_pages:8, brand_manual_extra:12, brand_manual_refresh_per_month:8, brand_auto_refresh:true,  calendar_level:'full', kpi_window_days:180, autopost_enabled:true  }
};

export async function getPlanLimitsForUser(userId: string): Promise<PlanLimits> {
  // 1) Find brugerens plan
  const { data: prof } = await admin
    .from('profiles')
    .select('plan_id')
    .eq('user_id', userId)
    .maybeSingle();

  const plan = (prof?.plan_id || 'free').toLowerCase();

  // 2) Slå limits op i DB (ellers fald tilbage)
  const { data: row } = await admin
    .from('plan_limits')
    .select('*')
    .eq('plan_id', plan)
    .maybeSingle();

  if (row) return row as PlanLimits;
  return FALLBACK[plan] || FALLBACK.free;
}
