import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

/**
 * Resolves the current user's Google id_token from the NextAuth session cookie.
 * Uses `next/headers`, so it works ambiently inside any App Router server code
 * (route handlers, server components) without threading the request through.
 */
export async function idToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  // getToken reads `req.cookies` (a parsed store), NOT a cookie header string —
  // passing the header left req.cookies undefined, so it always returned null.
  // next-auth's SessionStore accepts anything with a `.getAll()`, which is
  // exactly what next/headers `cookies()` provides, so hand it the store.
  // `secureCookie` must also be set so it looks for the `__Secure-` cookie name
  // (it otherwise derives this from NEXTAUTH_URL/VERCEL env and misses it).
  const secureCookie = cookieStore.has('__Secure-next-auth.session-token');

  const token = await getToken({
    req: { cookies: cookieStore } as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });
  return token?.idToken;
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
