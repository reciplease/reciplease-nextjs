import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { BACKEND_URL, idToken } from '@/lib/backend';

// TEMPORARY diagnostic for the post-auth-rollout 401s. Reports whether the
// session cookie decodes, whether it carries an id_token, that token's
// unverified claims, and the backend's verdict. Reflects only the caller's own
// cookie and never returns raw token values. REMOVE once confirmed working.

function decodeClaims(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  } catch {
    return { error: 'undecodable' };
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);

  const raw =
    cookieStore.get('__Secure-next-auth.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value;

  let sessionDecoded: unknown = 'no session cookie';
  if (raw) {
    try {
      const t = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET ?? '' });
      sessionDecoded = t
        ? { ok: true, fields: Object.keys(t), hasIdToken: Boolean(t.idToken), error: t.error }
        : { ok: false, value: 'null' };
    } catch (e) {
      sessionDecoded = { ok: false, threw: e instanceof Error ? e.message : String(e) };
    }
  }

  const token = await idToken();
  let claims: unknown = null;
  let backendStatus: number | null = null;
  let backendWwwAuthenticate: string | null = null;
  if (token) {
    const c = decodeClaims(token);
    const exp = typeof c.exp === 'number' ? c.exp : undefined;
    claims = {
      aud: c.aud,
      iss: c.iss,
      email: c.email,
      email_verified: c.email_verified,
      expired: exp ? exp < Math.floor(Date.now() / 1000) : undefined,
    };
    const upstream = await fetch(`${BACKEND_URL}/api/recipes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    backendStatus = upstream.status;
    backendWwwAuthenticate = upstream.headers.get('www-authenticate');
  }

  return NextResponse.json({
    cookieNames,
    nextauthSecretSet: Boolean(process.env.NEXTAUTH_SECRET),
    sessionDecoded,
    tokenForwarded: Boolean(token),
    claims,
    backendStatus,
    backendWwwAuthenticate,
  });
}
