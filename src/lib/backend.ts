import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

/**
 * Resolves the current user's Google id_token from the NextAuth session cookie.
 * Uses `next/headers`, so it works ambiently inside any App Router server code
 * (route handlers, server components) without threading the request through.
 */
async function idToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const token = await getToken({
    // getToken only needs the cookie header; build a minimal req-like from it.
    req: { headers: { cookie: cookieStore.toString() } } as never,
    secret: process.env.NEXTAUTH_SECRET,
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
