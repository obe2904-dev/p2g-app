# Arkitektur (MVP)

**Frontend**: Next.js (Vercel). App-ruter: /auth, /welcome, /posts, /posts/new, /posts/[id]/edit, /pricing.  
**DB/Backend**: Supabase (auth, RLS, tables: posts_app, ai_usage, plan_features, …).  
**Lagring**: Supabase Storage (images/).  
**AI**: API routes (/api/ai/suggest, /api/media/analyze).  
**Målinger (KPI)**: /api/metrics/ingest + tables (posts_metrics, posts_channels) — Make henter fra kanaler.  
**Pakker/limits**: plan_features styrer kvoter/flags pr. plan.  
**Domæner**: cafe.post2grow.dk (MVP). post2grow.dk senere.

## Kendte next steps
- Onboarding/wizard: organizations + organization_members.
- Lille AI-løft på forslag (forklaring + hashtags).
- Plasmic-landing (Option 1: loader i Next app).
