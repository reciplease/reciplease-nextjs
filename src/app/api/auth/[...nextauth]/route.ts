import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth-options';

const handler = NextAuth(authOptions);

// Local-only: NEXT_PUBLIC_FAKE_AUTH=true makes the session endpoint report a
// signed-in user with a fake handle/accessToken. next-auth's SessionProvider
// refetches /api/auth/session on mount, so without this it would overwrite the
// injected fake session with null. Only the GET /session route is faked;
// everything else (sign-in/out, callbacks) falls through to the real NextAuth
// handler.
const FAKE_AUTH = process.env.NEXT_PUBLIC_FAKE_AUTH === 'true';
const fakeSession = {
  user: { name: 'Local User', handle: 'local-dev-user' },
  accessToken: 'fake-local-dev-access-token',
  expires: '2999-12-31T23:59:59.999Z',
};

// The literal, dedicated cookie the refresh-redemption flow reads server-to-server
// (see redeemRefreshToken/refreshCookie in auth-options.ts/backend.ts) and that
// src/middleware.ts forwards on from a silent-refresh fetch. NextAuth v4's own
// authorize()/jwt() callbacks have no `res` to Set-Cookie with directly — the raw
// refresh token instead rides inside NextAuth's own encrypted session JWE as
// token.recipleaseRefreshToken (see auth-options.ts), and gets mirrored out here,
// after NextAuth has produced its response, as this separate literal cookie.
const REFRESH_COOKIE_NAME = 'reciplease-refresh';
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_COOKIE_BASE_NAMES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];

function parseSetCookie(raw: string): { name: string; value: string } {
  const eq = raw.indexOf('=');
  const semi = raw.indexOf(';');
  return {
    name: raw.slice(0, eq),
    value: raw.slice(eq + 1, semi === -1 ? undefined : semi),
  };
}

/** Every `Set-Cookie` header value on a Response, however this runtime exposes them. */
function allSetCookies(res: Response): string[] {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(res.headers);
  // Fallback for runtimes without Headers#getSetCookie() (added in undici/Node 18.14+):
  // most fetch implementations still yield one forEach entry per Set-Cookie header
  // (it's specifically exempted from header-combining), so this is a reasonable
  // best-effort — but if we ever see just one combined value, that's still handled
  // fine below since we're only looking for the session-token cookie(s) by name.
  const out: string[] = [];
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') out.push(value);
  });
  return out;
}

/**
 * Reconstructs the outgoing NextAuth session JWE from NextAuth's own Set-Cookie
 * header(s) in its response (handling the chunked `.0`/`.1`/... form for large
 * tokens), so it can be decoded to find recipleaseRefreshToken.
 */
// `found: false` means NextAuth's response didn't touch the session cookie at all
// (nothing to mirror). `found: true, value: ''` means it did — most notably
// sign-out, which clears the cookie by writing an empty value — and should still
// be treated as "no recipleaseToken" below, not skipped as if nothing happened.
/**
 * Rewrites the `Expires` attribute of every session-token Set-Cookie entry (base or
 * chunked) to {@code expiresAtMillis} — the refresh token's actual expiry, straight from
 * the backend (see auth-options.ts's recipleaseRefreshTokenExpiresAt). NextAuth itself
 * always computes Expires from the static `session.maxAge` config (see next-auth's
 * core/routes/session.js and callback.js — there's no per-request hook to override it),
 * so this is the only place that can make the browser's actual cookie lifetime track the
 * real, possibly-rotated refresh token expiry instead of that static ceiling.
 */
function withRewrittenSessionExpiry(setCookies: string[], expiresAtMillis: number): string[] {
  const expiresHeader = new Date(expiresAtMillis).toUTCString();
  return setCookies.map((raw) => {
    const { name } = parseSetCookie(raw);
    const isSessionCookie = SESSION_COOKIE_BASE_NAMES.some((base) => name === base || name.startsWith(`${base}.`));
    if (!isSessionCookie) return raw;
    return /;\s*Expires=[^;]+/i.test(raw)
      ? raw.replace(/;\s*Expires=[^;]+/i, `; Expires=${expiresHeader}`)
      : `${raw}; Expires=${expiresHeader}`;
  });
}

function outgoingSessionToken(setCookies: string[]): { found: boolean; value: string } {
  for (const base of SESSION_COOKIE_BASE_NAMES) {
    let single: string | undefined;
    const chunks: string[] = [];
    for (const raw of setCookies) {
      const { name, value } = parseSetCookie(raw);
      if (name === base) single = value;
      const match = name.match(new RegExp(`^${base}\\.(\\d+)$`));
      if (match) chunks[Number(match[1])] = value;
    }
    if (single !== undefined) return { found: true, value: single };
    if (chunks.length > 0) return { found: true, value: chunks.join('') };
  }
  return { found: false, value: '' };
}

/**
 * After NextAuth produces a response, mirror token.recipleaseRefreshToken (if the
 * response just (re)wrote a session cookie carrying one) onto a genuine, dedicated,
 * httpOnly `reciplease-refresh` cookie — distinct from the NextAuth session cookie,
 * readable server-side via cookies() (see backend.ts's refreshCookie()) without ever
 * decoding the NextAuth JWE. Emits a clearing cookie when the outgoing session has no
 * recipleaseToken at all (signed out). Leaves the response untouched — same body,
 * status, and existing headers — when there's no session cookie to read at all, or
 * the session is live but simply has no refresh token to mirror (e.g. a
 * provider-linking exchange, which the backend never issues one for).
 */
async function mirrorRefreshCookie(res: Response): Promise<Response> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return res;

  const setCookies = allSetCookies(res);
  const outgoing = outgoingSessionToken(setCookies);
  if (!outgoing.found) return res;

  let token;
  if (outgoing.value) {
    try {
      token = await decode({ token: outgoing.value, secret });
    } catch {
      return res;
    }
  }
  // else: an explicit empty value (sign-out) — token stays undefined, handled
  // as "no recipleaseToken" below.

  const attrs = ['HttpOnly', 'Path=/api/auth', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');

  // The refresh token's real expiry, when the token carries one (every session minted
  // since refreshTokenExpiresAt shipped) — the authoritative source for both cookie
  // lifetimes below, in place of the hardcoded REFRESH_COOKIE_MAX_AGE_SECONDS fallback
  // (kept only for a pre-migration session whose JWE predates this field).
  const refreshExpiresAtMillis =
    typeof token?.recipleaseRefreshTokenExpiresAt === 'number' ? token.recipleaseRefreshTokenExpiresAt : undefined;
  const refreshMaxAgeSeconds =
    refreshExpiresAtMillis !== undefined
      ? Math.max(0, Math.round((refreshExpiresAtMillis - Date.now()) / 1000))
      : REFRESH_COOKIE_MAX_AGE_SECONDS;

  let mirroredCookie: string;
  if (!token?.recipleaseToken) {
    mirroredCookie = `${REFRESH_COOKIE_NAME}=; Max-Age=0; ${attrs.join('; ')}`;
  } else if (token.recipleaseRefreshToken) {
    mirroredCookie = `${REFRESH_COOKIE_NAME}=${token.recipleaseRefreshToken}; Max-Age=${refreshMaxAgeSeconds}; ${attrs.join('; ')}`;
  } else {
    return res;
  }

  const outgoingSetCookies =
    refreshExpiresAtMillis !== undefined ? withRewrittenSessionExpiry(setCookies, refreshExpiresAtMillis) : setCookies;

  // Rebuild headers rather than mutating res.headers in place: preserve every
  // existing header (including every pre-existing Set-Cookie, e.g. the session
  // cookie itself) and append the mirrored cookie as its own Set-Cookie entry —
  // Headers#append never folds multiple set-cookie values into one.
  const headers = new Headers();
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') headers.set(key, value);
  });
  for (const existing of outgoingSetCookies) headers.append('set-cookie', existing);
  headers.append('set-cookie', mirroredCookie);

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function GET(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  if (FAKE_AUTH) {
    const { nextauth } = await ctx.params;
    if (nextauth?.[0] === 'session') {
      return NextResponse.json(fakeSession);
    }
  }
  return mirrorRefreshCookie(await handler(req, ctx));
}

async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return mirrorRefreshCookie(await handler(req, ctx));
}

export { GET, POST };
