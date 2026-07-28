import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 *
 * This is a UX guard, not a security boundary: it only decodes the token's `exp`
 * so an expired or missing session bounces to /auth/login before a dashboard page
 * renders. Signature verification — the part that actually matters — happens in
 * the API, which never trusts anything decided here.
 */

const TOKEN_COOKIE = 'crm_token';

function tokenIsUsable(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith('/auth');
  const isDashboard = pathname.startsWith('/dashboard');
  if (!isAuthPage && !isDashboard) return NextResponse.next();

  const isLoggedIn = tokenIsUsable(req.cookies.get(TOKEN_COOKIE)?.value);

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  if (!isLoggedIn && isDashboard) {
    const loginUrl = new URL('/auth/login', req.nextUrl);
    loginUrl.searchParams.set('reason', 'session-expired');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/auth/:path*', '/dashboard/:path*'],
};
