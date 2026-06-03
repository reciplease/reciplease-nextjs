import { NextResponse } from 'next/server';
import { BACKEND_URL, idToken } from '@/lib/backend';

// TEMPORARY diagnostic for the post-auth-rollout 401s. Reports, for the current
// session, whether an id_token is being forwarded, its (unverified) key claims,
// and the backend's actual rejection reason. Reflects only the caller's own
// cookie. REMOVE once the 401 cause is fixed.

function decodeClaims(jwt: string): Record<string, unknown> | { error: string } {
  try {
    const payload = jwt.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return { error: 'could not decode' };
  }
}

export async function GET() {
  const token = await idToken();

  let claims: unknown = null;
  if (token) {
    const c = decodeClaims(token) as Record<string, unknown>;
    const exp = typeof c.exp === 'number' ? c.exp : undefined;
    claims = {
      aud: c.aud,
      iss: c.iss,
      email: c.email,
      email_verified: c.email_verified,
      exp,
      expired: exp ? exp < Math.floor(Date.now() / 1000) : undefined,
      secondsUntilExpiry: exp ? exp - Math.floor(Date.now() / 1000) : undefined,
    };
  }

  const upstream = await fetch(`${BACKEND_URL}/api/recipes`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return NextResponse.json({
    tokenForwarded: Boolean(token),
    claims,
    backendStatus: upstream.status,
    backendWwwAuthenticate: upstream.headers.get('www-authenticate'),
  });
}
