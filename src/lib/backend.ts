import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

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
 * Resolves the current user's Google id_token from the NextAuth session cookie.
 * Uses `next/headers`, so it works ambiently inside any App Router server code
 * (route handlers, server components) without threading the request through.
 */
export async function idToken(): Promise<string | undefined> {
  const raw = sessionToken(await cookies());
  const secret = process.env.NEXTAUTH_SECRET;
  if (!raw || !secret) return undefined;
  try {
    const token = await decode({ token: raw, secret });
    return token?.idToken;
  } catch {
    // Malformed/expired session JWE — treat as not signed in rather than crash.
    return undefined;
  }
}

export async function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await idToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers });
}
