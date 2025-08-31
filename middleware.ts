// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // 1) Behold din branchelogik
  const host = req.headers.get('host') || '';
  let industry = 'cafe';
  if (host.startsWith('frisor.')) industry = 'frisor';
  else if (host.startsWith('fysio.')) industry = 'fysio';
  else if (host.startsWith('cafe.')) industry = 'cafe';

  // 2) Lav svar-objektet FØR Supabase, så vi kan sætte cookies på det
  const res = NextResponse.next();

  // 3) Supabase: sørg for at forny/sætte session-cookies
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  // 4) Sæt din industry-cookie (må gerne være efter getSession)
  res.cookies.set('industry', industry, { path: '/', httpOnly: false });

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
