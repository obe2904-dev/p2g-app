import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  let industry = 'cafe';

  if (host.startsWith('frisor.')) industry = 'frisor';
  else if (host.startsWith('fysio.')) industry = 'fysio';
  else if (host.startsWith('cafe.')) industry = 'cafe';
  // For preview/vercel.app m.m. bruger vi 'cafe' som standard

  const res = NextResponse.next();
  res.cookies.set('industry', industry, { path: '/', httpOnly: false });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
