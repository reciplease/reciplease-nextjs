import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { BACKEND_URL } from '@/lib/backend';

// TEMPORARY diagnostic for the post-auth-rollout 401s. Reports where the BFF
// id_token lookup breaks: which session cookie is present, whether getToken
// decodes anything, and which fields the decoded token carries. Reflects only
// the caller's own cookie and never returns raw token values. REMOVE once fixed.

export async function GET() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  const hasSecure = cookieStore.has('__Secure-next-auth.session-token');
  const hasPlain = cookieStore.has('next-auth.session-token');

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  let getTokenResult: unknown;
  let token: { idToken?: string; error?: unknown; [k: string]: unknown } | null =
    null;
  try {
    token = (await getToken({
      req: { headers: { cookie: cookieHeader } } as never,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: hasSecure,
    })) as typeof token;
    getTokenResult = token
      ? {
          returned: 'object',
          fields: Object.keys(token),
          hasIdToken: Boolean(token.idToken),
          error: token.error,
        }
      : { returned: 'null' };
  } catch (e) {
    getTokenResult = {
      returned: 'threw',
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const idToken = token?.idToken;
  let backendStatus: number | null = null;
  let backendWwwAuthenticate: string | null = null;
  if (idToken) {
    const upstream = await fetch(`${BACKEND_URL}/api/recipes`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    backendStatus = upstream.status;
    backendWwwAuthenticate = upstream.headers.get('www-authenticate');
  }

  return NextResponse.json({
    cookieNames,
    hasSecure,
    hasPlain,
    nextauthSecretSet: Boolean(process.env.NEXTAUTH_SECRET),
    getToken: getTokenResult,
    tokenForwarded: Boolean(idToken),
    backendStatus,
    backendWwwAuthenticate,
  });
}
