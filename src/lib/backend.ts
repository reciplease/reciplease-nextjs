import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { BACKEND_URL } from '@/lib/backend-url';

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
 * Unlike the old Google id_token this replaced, the Reciplease JWT's validity
 * window is controlled by our own backend, not Google — there is no refresh
 * dance here; if it's expired the backend will simply 401 and the user signs
 * in again.
 */
export async function accessToken(): Promise<string | undefined> {
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
  return token?.recipleaseToken as string | undefined;
}
