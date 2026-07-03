import { NextRequest, NextResponse } from 'next/server';
import { accessToken } from '@/lib/backend';
import { GOOGLE_HEALTH_OAUTH_COOKIE } from '@/app/api/google-health/authorize/route';
import { exchangeGoogleHealthCode, storeGoogleHealthTokens } from '@/lib/googleHealthTokens';

// Where Google Health linking always lands the user back, success or failure —
// the Settings page reads `?googleHealth=connected|error` to show a banner.
const SETTINGS_PATH = '/settings';

// Built from NEXTAUTH_URL rather than req.url — behind Netlify's proxy, Next.js
// API routes can see an internal deploy hostname (e.g. *.netlify.app) in the
// request URL instead of the public domain. Redirecting there would land the
// user on a host that doesn't share the session cookie's domain, making them
// appear logged out even though linking succeeded.
function siteUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL ?? req.url;
}

function redirectWithStatus(req: NextRequest, status: 'connected' | 'error'): NextResponse {
  const url = new URL(SETTINGS_PATH, siteUrl(req));
  url.searchParams.set('googleHealth', status);
  const res = NextResponse.redirect(url);
  res.cookies.delete(GOOGLE_HEALTH_OAUTH_COOKIE);
  return res;
}

// Completes the Google Health incremental-authorization linking flow started by
// src/app/api/google-health/authorize/route.ts. Bypasses the generic proxy (see
// src/app/api/[...proxy]/route.ts) because this needs to read the state cookie
// and issue a redirect rather than relay a JSON response — but forwards the
// user's Reciplease session to the backend the same way the proxy does:
// resolve the JWT from the NextAuth cookie and send it as the
// `reciplease-session` cookie.
//
// The Java backend never holds the Google OAuth client secret, so the
// code->token exchange happens here, in this app, using the same Google
// client NextAuth login uses (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) — then
// the resulting tokens are pushed to the backend to store.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const raw = req.cookies.get(GOOGLE_HEALTH_OAUTH_COOKIE)?.value;

  if (!code || !state || !raw) {
    return redirectWithStatus(req, 'error');
  }

  let stored: { state?: string };
  try {
    stored = JSON.parse(raw);
  } catch {
    return redirectWithStatus(req, 'error');
  }

  if (!stored.state || stored.state !== state) {
    return redirectWithStatus(req, 'error');
  }

  const token = await accessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/login', siteUrl(req)));
  }

  try {
    // Note: no codeVerifier here — unlike the old Fitbit flow, Google's
    // server-side confidential-client flow doesn't use PKCE.
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/google-health/callback`;
    const tokens = await exchangeGoogleHealthCode(code, redirectUri);
    await storeGoogleHealthTokens(token, tokens);
  } catch {
    return redirectWithStatus(req, 'error');
  }

  return redirectWithStatus(req, 'connected');
}
