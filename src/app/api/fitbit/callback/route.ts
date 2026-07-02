import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';
import { FITBIT_OAUTH_COOKIE } from '@/app/api/fitbit/authorize/route';

// Where Fitbit linking always lands the user back, success or failure — the
// Settings page reads `?fitbit=connected|error` to show a banner.
const SETTINGS_PATH = '/settings';

function redirectWithStatus(req: NextRequest, status: 'connected' | 'error'): NextResponse {
  const url = new URL(SETTINGS_PATH, req.url);
  url.searchParams.set('fitbit', status);
  const res = NextResponse.redirect(url);
  res.cookies.delete(FITBIT_OAUTH_COOKIE);
  return res;
}

// Completes the Fitbit OAuth (Authorization Code + PKCE) linking flow started by
// src/app/api/fitbit/authorize/route.ts. Bypasses the generic proxy (see
// src/app/api/[...proxy]/route.ts) because this needs to read the PKCE cookie and
// issue a redirect rather than relay a JSON response — but forwards the user's
// Reciplease session to the backend the same way the proxy does: resolve the JWT
// from the NextAuth cookie and send it as the `reciplease-session` cookie.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const raw = req.cookies.get(FITBIT_OAUTH_COOKIE)?.value;

  if (!code || !state || !raw) {
    return redirectWithStatus(req, 'error');
  }

  let stored: { codeVerifier?: string; state?: string };
  try {
    stored = JSON.parse(raw);
  } catch {
    return redirectWithStatus(req, 'error');
  }

  if (!stored.codeVerifier || !stored.state || stored.state !== state) {
    return redirectWithStatus(req, 'error');
  }

  const token = await accessToken();
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/fitbit/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `reciplease-session=${token}`,
      },
      body: JSON.stringify({ code, codeVerifier: stored.codeVerifier }),
    });
    if (!response.ok) {
      return redirectWithStatus(req, 'error');
    }
  } catch {
    return redirectWithStatus(req, 'error');
  }

  return redirectWithStatus(req, 'connected');
}
