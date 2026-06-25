import type { NextAuthOptions, Account } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import type { JWT } from 'next-auth/jwt';
import { BACKEND_URL } from '@/lib/backend-url';
import { accessToken } from '@/lib/backend';

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

    const body = await response.json();
    return { ok: true, token: body.token, userId: body.userId, handle: body.handle ?? null };
  } catch {
    return { ok: false, error: 'ExchangeError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt' },
  // Use our own branded sign-in page instead of NextAuth's default UI.
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, account, user }) {
      // `account` is set only right after an OAuth handshake (sign-in or a link).
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
