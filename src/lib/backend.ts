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

  // getToken chooses the session cookie name from `secureCookie`, which it
  // otherwise derives from NEXTAUTH_URL/VERCEL env — on Netlify that lands on
  // the non-secure name and misses the actual `__Secure-` cookie, so no token
  // is found. Detect "secure" from the cookie that is genuinely present, and
  // hand getToken a clean name->value map rather than a serialized header.
  const cookieMap = Object.fromEntries(
    cookieStore.getAll().map((c) => [c.name, c.value]),
  );
  const secureCookie = '__Secure-next-auth.session-token' in cookieMap;

  const token = await getToken({
    req: { cookies: cookieMap, headers: {} } as never,
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
