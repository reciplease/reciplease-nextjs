import { BACKEND_URL } from '@/lib/backend-url';

// Server-only helpers for the Google Health OAuth token lifecycle. The Java
// backend never holds the Google OAuth client secret — this app does (it
// already needs GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET for NextAuth login), so
// this app performs the code->token exchange AND all refreshing, then pushes
// the resulting tokens to the backend to store via PUT /api/google-health/connection.
//
// Never import this module from a client component — it reads
// GOOGLE_CLIENT_SECRET and talks to Google's token endpoint directly.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeGoogleHealthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }
  return response.json();
}

export async function refreshGoogleHealthToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }
  return response.json();
}

// Pushes tokens to the backend to store. Google's refresh grant doesn't always
// return a new refresh_token, so callers refreshing an existing connection
// should pass the prior refresh token as fallbackRefreshToken.
export async function storeGoogleHealthTokens(
  sessionToken: string,
  tokens: GoogleTokenResponse,
  fallbackRefreshToken?: string,
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/google-health/connection`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      cookie: `reciplease-session=${sessionToken}`,
    },
    body: JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? fallbackRefreshToken,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to store Google Health tokens: ${response.status}`);
  }
}

type BackendConnection = {
  connected: boolean;
  expiresAt: string | null;
  refreshToken: string | null;
};

const FRESHNESS_WINDOW_MS = 60_000;

// Proactively refreshes the stored Google Health access token if it's expired
// (or about to expire) before the caller hits a backend endpoint that no
// longer auto-refreshes on its own. No-ops when not connected, when there's
// no refresh token to use, or when the current token is still fresh. Swallows
// errors — a failed proactive refresh shouldn't crash the caller; the
// subsequent backend call will fail naturally and surface its own error.
export async function ensureFreshGoogleHealthConnection(sessionToken: string): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/google-health/connection`, {
      method: 'GET',
      headers: { cookie: `reciplease-session=${sessionToken}` },
    });
    if (!response.ok) return;

    const body: BackendConnection = await response.json();
    if (!body.connected || !body.refreshToken) return;

    if (body.expiresAt) {
      const expiresAtMs = new Date(body.expiresAt).getTime();
      if (!Number.isNaN(expiresAtMs) && expiresAtMs - Date.now() > FRESHNESS_WINDOW_MS) {
        return;
      }
    }

    const refreshed = await refreshGoogleHealthToken(body.refreshToken);
    await storeGoogleHealthTokens(sessionToken, refreshed, body.refreshToken);
  } catch (err) {
    console.error('Failed to proactively refresh Google Health token', err);
  }
}
