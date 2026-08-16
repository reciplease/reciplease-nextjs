import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isJwtExpired } from '@/lib/jwt';

// Require a live Reciplease session for all pages, with two twists over a bare
// NextAuth session check:
//
//  1. Some pages are intentionally public (readable while signed out) — see
//     isPublicPage below. Those never redirect to /login, but we still want to
//     *try* a silent refresh on them so a signed-in visitor whose access token
//     just lapsed gets it renewed quietly rather than silently falling back to
//     anonymous.
//  2. A decodable NextAuth session cookie isn't enough on its own — its embedded
//     Reciplease JWT (auth-options.ts's jwt callback) has its own, shorter expiry
//     and can be flagged with an error (e.g. a failed sign-in exchange or an
//     unrecoverable expiry) independently of the outer cookie still being valid.
//
// This file replaces src/proxy.ts (never actually wired up as real middleware —
// there was no middleware.ts re-exporting it, so none of its logic ran at all,
// which is very likely why a signed-in user could still see a public page render
// "logged out" after a while: nothing here was ever attempting recovery).
//
// Set NEXT_PUBLIC_AUTH_DISABLED=true (or NEXT_PUBLIC_FAKE_AUTH=true) to bypass
// auth entirely (local dev only).

/**
 * /recipes and /recipes/[recipeId] are publicly readable, as is /settings
 * (client-only appearance/accessibility prefs) and /invite/[code] (handles its
 * own auth: preview before sign-in, accept after). /recipes/new shares the same
 * one-segment-past-/recipes shape as /recipes/[recipeId] but must stay gated —
 * that's the one distinction a matcher regex alone can't make (Next's own page
 * router does resolve them to distinct files correctly), so it's done here as
 * plain path logic instead.
 */
function isPublicPage(pathname: string): boolean {
  if (pathname === '/recipes' || pathname === '/settings') return true;
  if (pathname === '/recipes/new') return false;
  if (/^\/recipes\/[^/]+$/.test(pathname)) return true;
  if (/^\/invite\/[^/]+$/.test(pathname)) return true;
  return false;
}

function loginRedirect(req: NextRequest): NextResponse {
  const url = new URL('/login', req.url);
  url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

/** Every `Set-Cookie` header value on a Response, however this runtime exposes them. */
function allSetCookies(res: Response): string[] {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(res.headers);
  const out: string[] = [];
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') out.push(value);
  });
  return out;
}

/**
 * Re-triggers NextAuth's own jwt() callback server-side by hitting our own
 * /api/auth/session endpoint with the incoming request's cookies attached. If
 * auth-options.ts's periodic-revalidation branch successfully redeems a refresh
 * token, that response carries the rotated NextAuth session cookie AND (via the
 * [...nextauth] route wrapper) the mirrored `reciplease-refresh` cookie — both
 * of which we copy onto the response actually going back to the browser here,
 * since a background fetch's own Set-Cookie headers never reach the browser
 * otherwise.
 */
async function attemptSilentRefresh(req: NextRequest): Promise<{ live: boolean; setCookies: string[] }> {
  try {
    const res = await fetch(new URL('/api/auth/session', req.url), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });
    const setCookies = allSetCookies(res);
    if (!res.ok) return { live: false, setCookies };

    const body = (await res.json()) as { error?: string; accessToken?: string } | null;
    return { live: !!body && !body.error && !!body.accessToken, setCookies };
  } catch {
    return { live: false, setCookies: [] };
  }
}

export default async function middleware(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' || process.env.NEXT_PUBLIC_FAKE_AUTH === 'true') {
    return NextResponse.next();
  }

  const pathname = req.nextUrl.pathname;
  const publicPage = isPublicPage(pathname);

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || token.error) {
    return publicPage ? NextResponse.next() : loginRedirect(req);
  }

  const recipleaseToken = token.recipleaseToken as string | undefined;
  if (!recipleaseToken || isJwtExpired(recipleaseToken)) {
    const { live, setCookies } = await attemptSilentRefresh(req);
    if (!live) {
      return publicPage ? NextResponse.next() : loginRedirect(req);
    }
    const response = NextResponse.next();
    for (const cookie of setCookies) response.headers.append('set-cookie', cookie);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Excludes: the root (/ redirects to /recipes before auth would apply), every
  // /api/* route (a BFF that forwards the bearer token and returns 401/403 itself
  // — redirecting a fetch() call to an HTML sign-in page would break it), Next.js
  // internals, and any path with a file extension (public static assets like the
  // header logo, favicons, manifest.json). Unlike proxy.ts's old matcher, this one
  // does NOT exclude /recipes, /recipes/[recipeId], /settings, or /invite/[code] —
  // those are public pages, but they still need to run through this middleware so
  // a signed-in visitor's lapsed access token gets a silent-refresh attempt rather
  // than never being checked at all.
  matcher: ['/((?!$|api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
};
