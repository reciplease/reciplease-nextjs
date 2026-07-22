import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { BACKEND_URL } from '@/lib/backend-url';
import { isJwtExpired } from '@/lib/jwt';

export { BACKEND_URL };

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Reads the raw NextAuth session JWE from the cookie store, handling both the
 * secure/non-secure name and chunked (`.0`, `.1`, ...) cookies.
 *
 * We deliberately avoid `getToken()`: it reads `req.cookies` off a Next/Node
 * request object, and feeding it the App Router cookie store throws at runtime.
 * Reading the cookie value directly and `decode()`-ing it is the stable path.
 */
function sessionToken(store: CookieStore): string | undefined {
  const base =
    store.has('__Secure-next-auth.session-token') ||
    store.has('__Secure-next-auth.session-token.0')
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

  const single = store.get(base)?.value;
  if (single) return single;

  let joined = '';
  for (let i = 0; ; i++) {
    const chunk = store.get(`${base}.${i}`)?.value;
    if (!chunk) break;
    joined += chunk;
  }
  return joined || undefined;
}

/**
 * Resolves the current user's Reciplease JWT (minted by POST
 * /api/auth/exchange during sign-in) from the NextAuth session cookie. Uses
 * `next/headers`, so it works ambiently inside any App Router server code
 * (route handlers, server components) without threading the request through.
 *
 * The Reciplease JWT's validity window is controlled by our own backend, not any
 * OAuth provider — auth-options.ts's jwt callback silently refreshes it via POST
 * /api/auth/refresh while a session is active, so in practice it rarely reaches
 * this function already expired. If it ever does anyway (a session nobody's
 * touched in a while), the backend will simply 401 and the user signs in again.
 * That's fine for authenticated calls, but for a request that's only ever meant
 * to be anonymous, sending a known-expired token is actively harmful (see
 * isJwtExpired), so it's filtered out here rather than left for every caller to
 * reason about.
 */
export async function accessToken(): Promise<string | undefined> {
  // Manual-testing escape hatch: `RECIPLEASE_DEV_TOKEN=$(node scripts/mint-dev-token.mjs
  // <userId>) yarn dev` makes every proxied call authenticate as that user without a
  // Google sign-in (which doesn't work on localhost). Gated on NODE_ENV so a stray env
  // var can never override real sessions in a production build. Deliberately not
  // filtered through isJwtExpired: when manually testing you want the backend's 401 to
  // tell you the token has lapsed, not a silent fallback to anonymous.
  if (process.env.NODE_ENV === 'development' && process.env.RECIPLEASE_DEV_TOKEN) {
    return process.env.RECIPLEASE_DEV_TOKEN;
  }

  const raw = sessionToken(await cookies());
  const secret = process.env.NEXTAUTH_SECRET;
  if (!raw || !secret) return undefined;

  let token;
  try {
    token = await decode({ token: raw, secret });
  } catch {
    // Malformed session JWE — treat as not signed in rather than crash.
    return undefined;
  }
  const recipleaseToken = token?.recipleaseToken as string | undefined;
  return recipleaseToken && !isJwtExpired(recipleaseToken) ? recipleaseToken : undefined;
}
