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
 * Mints a fresh Google id_token from the stored refresh_token. The BFF reads the
 * session cookie directly (see idToken), which bypasses NextAuth's jwt-callback
 * refresh, so the stored id_token would otherwise go stale after ~1h. Mirrors
 * the refresh in src/lib/auth-options.ts.
 */
async function refreshIdToken(refreshToken: string): Promise<string | undefined> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) return undefined;
    const refreshed = await response.json();
    return refreshed.id_token as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the current user's Google id_token from the NextAuth session cookie,
 * refreshing it on demand when the stored one has expired. Uses `next/headers`,
 * so it works ambiently inside any App Router server code (route handlers,
 * server components) without threading the request through.
 */
export async function idToken(): Promise<string | undefined> {
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
  if (!token?.idToken) return undefined;

  // Reuse the stored id_token while valid (60s margin); otherwise refresh.
  const fresh =
    typeof token.expiresAt === 'number' &&
    Date.now() / 1000 < token.expiresAt - 60;
  if (fresh) return token.idToken;

  if (token.refreshToken) {
    const refreshed = await refreshIdToken(token.refreshToken);
    if (refreshed) return refreshed;
  }
  return token.idToken; // best effort; backend will 401 if genuinely expired
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
