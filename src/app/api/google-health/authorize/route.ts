import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { accessToken } from '@/lib/backend';

// Short-lived cookie holding the state across the redirect to Google and back.
// httpOnly so client JS never sees it; cleared by the callback route once
// consumed (see src/app/api/google-health/callback/route.ts). Unlike the old
// Fitbit flow, no PKCE code_verifier is stored here — Google's server-side
// confidential-client flow doesn't need one.
export const GOOGLE_HEALTH_OAUTH_COOKIE = 'google_health_oauth';

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

// Starts the Google Health incremental-authorization linking flow. Requires an
// authenticated Reciplease session — we determine that the same way the generic
// proxy does, by resolving the Reciplease JWT out of the NextAuth session cookie,
// rather than pulling in a separate getServerSession() call.
//
// This deliberately reuses the SAME Google OAuth client (GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET) that NextAuth's GoogleProvider already uses for login
// (see src/lib/auth-options.ts) — Google's documented incremental-authorization
// pattern for requesting additional scopes from an already-signed-in user,
// rather than registering a second app.
export async function GET(req: NextRequest) {
  const token = await accessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const state = base64url(randomBytes(16));

  const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/google-health/callback`;

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/googlehealth.nutrition.readonly https://www.googleapis.com/auth/googlehealth.nutrition.writeonly',
  );
  // Required to receive a refresh token.
  authorizeUrl.searchParams.set('access_type', 'offline');
  // Forces the consent screen even if the user previously consented to other
  // scopes — necessary to actually receive a refresh token on this
  // incremental grant.
  authorizeUrl.searchParams.set('prompt', 'consent');
  // Folds in previously-granted scopes (e.g. the login `email` scope) rather
  // than replacing them — Google's documented incremental-auth parameter.
  authorizeUrl.searchParams.set('include_granted_scopes', 'true');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GOOGLE_HEALTH_OAUTH_COOKIE, JSON.stringify({ state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
