import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { accessToken } from '@/lib/backend';

// Short-lived cookie holding the PKCE code_verifier + state across the redirect
// to Fitbit and back. httpOnly so client JS never sees it; cleared by the
// callback route once consumed (see src/app/api/fitbit/callback/route.ts).
export const FITBIT_OAUTH_COOKIE = 'fitbit_oauth';

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

// Starts the Fitbit OAuth (Authorization Code + PKCE) linking flow. Requires an
// authenticated Reciplease session — we determine that the same way the generic
// proxy does, by resolving the Reciplease JWT out of the NextAuth session cookie,
// rather than pulling in a separate getServerSession() call.
export async function GET(req: NextRequest) {
  const token = await accessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  const state = base64url(randomBytes(16));

  const redirectUri =
    process.env.FITBIT_REDIRECT_URI ?? `${process.env.NEXTAUTH_URL ?? ''}/api/fitbit/callback`;

  const authorizeUrl = new URL('https://www.fitbit.com/oauth2/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', process.env.FITBIT_CLIENT_ID ?? '');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'nutrition');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(FITBIT_OAUTH_COOKIE, JSON.stringify({ codeVerifier, state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
