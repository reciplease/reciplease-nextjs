import type { NextAuthOptions, Account, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';
import { OAuth2Client } from 'google-auth-library';
import { BACKEND_URL } from '@/lib/backend-url';
import { accessToken } from '@/lib/backend';
import type { components } from '@/types/generated/api';

type ExchangeResponseBody = components['schemas']['ExchangeResponse'];

// On sign-in, we exchange the OAuth provider's identity for a Reciplease JWT,
// which is what we forward to the backend as a bearer token from then on (the
// backend no longer trusts provider id_tokens directly). If the user is already
// signed in (linking a second provider), we pass their existing Reciplease JWT
// as `linkToken` so the backend links this new provider identity to the existing
// account instead of creating a separate one.

/**
 * The current user's existing Reciplease token, if they're already signed in.
 *
 * NextAuth does NOT carry the prior session's custom claims into the `token`
 * passed to this callback during a fresh `signIn()` — so when an authenticated
 * user links a second provider, `token.recipleaseToken` is undefined here. The
 * exchange runs server-side during the OAuth callback, though, where the user's
 * existing NextAuth session cookie is still on the request: recover the token
 * from it so linking attaches to the right account. Guarded because `cookies()`
 * throws if ever called outside a request scope.
 */
async function existingLinkToken(token: JWT): Promise<string | undefined> {
  if (token.recipleaseToken) return token.recipleaseToken;
  try {
    return (await accessToken()) ?? undefined;
  } catch {
    return undefined;
  }
}

export type ExchangeResult =
  | { ok: true; token: string; userId: string; handle: string | null }
  | { ok: false; error: string };

export async function exchangeIdentity(
  account: Pick<Account, 'provider' | 'providerAccountId'>,
  linkToken: string | undefined,
  email: string | null | undefined,
): Promise<ExchangeResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.RECIPLEASE_JWT_SIGNING_SECRET ?? '',
      },
      body: JSON.stringify({
        provider: account.provider,
        providerId: account.providerAccountId,
        linkToken,
        email,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: response.status === 409 ? 'IdentityConflict' : 'ExchangeError',
      };
    }

    const body: ExchangeResponseBody = await response.json();
    return { ok: true, token: body.token ?? '', userId: body.userId ?? '', handle: body.handle ?? null };
  } catch {
    return { ok: false, error: 'ExchangeError' };
  }
}

/**
 * Verifies a passkey signup/login ceremony and mints a Reciplease JWT — the passkey
 * equivalent of {@link exchangeIdentity}, except there's no separate provider identity to
 * verify out of band: the backend itself does the WebAuthn verification, so this just
 * forwards what the browser produced (see {@code src/lib/passkey.ts}) and adopts the result.
 */
async function authorizePasskey(mode: 'signup' | 'login', challenge: string, credential: string): Promise<User | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/passkey/${mode}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, credential: JSON.parse(credential) }),
    });
    if (!response.ok) return null;

    const body: ExchangeResponseBody = await response.json();
    return { id: body.userId ?? '', recipleaseToken: body.token, handle: body.handle ?? null };
  } catch {
    return null;
  }
}

const googleIdTokenClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies the ID token handed back by Google Identity Services' rendered
 * button (the "Continue as [Name]" flow, which shows the account before the
 * user clicks) and mints a Reciplease JWT — the GIS equivalent of {@link
 * exchangeIdentity}. Unlike the code-flow GoogleProvider below, this never
 * redirects to Google, so it can't carry a `linkToken` for account linking;
 * it's login/signup only, same restriction as {@link authorizePasskey}.
 */
async function authorizeGoogleCredential(credential: string): Promise<User | null> {
  try {
    const ticket = await googleIdTokenClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;

    // Reported as provider 'google' (not the NextAuth provider id below) so it
    // resolves to the same backend identity as the code-flow login/linking.
    const result = await exchangeIdentity({ provider: 'google', providerAccountId: payload.sub }, undefined, payload.email);
    if (!result.ok) return null;
    return { id: result.userId, recipleaseToken: result.token, handle: result.handle };
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          // Minimal login scope — no session.user.name/image are used anywhere in the
          // app, so `profile` isn't requested. Google Health's nutrition scopes are
          // requested separately via incremental authorization (see Settings > Google
          // Health), not bundled into login, per Google's own incremental-auth guidance.
          scope: 'openid email',
        },
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
    // Google Identity Services' rendered button (login page only — see
    // src/pages/login.tsx). Distinct from GoogleProvider above, which still
    // handles account linking in Settings via the redirect/code flow.
    CredentialsProvider({
      id: 'google-onetap',
      name: 'Google',
      credentials: {
        credential: { label: 'credential', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.credential) return null;
        return authorizeGoogleCredential(credentials.credential);
      },
    }),
    // Signup and login only — linking a passkey to an already signed-in account doesn't go
    // through NextAuth at all (see src/lib/passkey.ts's registerPasskey), since unlike OAuth
    // it needs no redirect dance, just a couple of fetches the Settings page makes directly.
    CredentialsProvider({
      id: 'passkey',
      name: 'Passkey',
      credentials: {
        mode: { label: 'mode', type: 'text' },
        challenge: { label: 'challenge', type: 'text' },
        credential: { label: 'credential', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.mode || !credentials?.challenge || !credentials?.credential) return null;
        if (credentials.mode !== 'signup' && credentials.mode !== 'login') return null;
        return authorizePasskey(credentials.mode, credentials.challenge, credentials.credential);
      },
    }),
  ],
  session: { strategy: 'jwt' },
  // Use our own branded sign-in page instead of NextAuth's default UI.
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, account, user }) {
      // `account` is set only right after a sign-in/link handshake (OAuth or passkey).
      if (account?.provider === 'passkey' || account?.provider === 'google-onetap') {
        // authorize() above already did the verification (WebAuthn ceremony or
        // Google ID token) and minted the JWT — no further round trip needed,
        // just adopt what it returned.
        if (user?.recipleaseToken) {
          token.recipleaseToken = user.recipleaseToken;
          token.userId = user.id;
          token.handle = user.handle ?? null;
          token.error = undefined;
        } else {
          token.error = 'ExchangeError';
        }
        return token;
      }

      // existingLinkToken recovers the current user's Reciplease JWT (if any) so
      // an already-signed-in user linking a second provider attaches it to their
      // existing account; otherwise it's a fresh login.
      if (account) {
        // `user` here is the provider's profile for this handshake, not the
        // previously-signed-in user — its email identifies *this* linked account.
        const result = await exchangeIdentity(account, await existingLinkToken(token), user?.email);
        if (result.ok) {
          token.recipleaseToken = result.token;
          token.userId = result.userId;
          token.handle = result.handle;
          token.error = undefined;
        } else {
          token.error = result.error;
        }
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      // Never expose raw tokens beyond what the client needs to call our own
      // backend: accessToken is the Reciplease JWT (not any provider token).
      session.accessToken = token.recipleaseToken;
      session.error = token.error;
      if (session.user) {
        session.user.handle = token.handle ?? null;
      }
      return session;
    },
  },
};
