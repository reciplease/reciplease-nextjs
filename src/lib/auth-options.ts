import type { NextAuthOptions, Account } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import type { JWT } from 'next-auth/jwt';
import { BACKEND_URL } from '@/lib/backend-url';

// On sign-in, we exchange the OAuth provider's identity for a Reciplease JWT,
// which is what we forward to the backend as a bearer token from then on (the
// backend no longer trusts provider id_tokens directly). If the user already
// has a Reciplease session (token.reciplaseToken is set from a previous
// sign-in), we pass it along as `linkToken` so the backend links this new
// provider identity to the existing account instead of creating/finding a
// separate one.

export type ExchangeResult =
  | { ok: true; token: string; userId: string; handle: string | null }
  | { ok: false; error: string };

export async function exchangeIdentity(
  account: Pick<Account, 'provider' | 'providerAccountId'>,
  linkToken: string | undefined,
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
    async jwt({ token, account }) {
      // Initial sign-in (or a link attempt for an already-signed-in user):
      // NextAuth passes a fresh `account` only right after the OAuth handshake.
      // `token` still carries whatever was decoded from the existing session
      // cookie, so token.reciplaseToken (if present) is the current user's
      // existing Reciplease JWT — pass it as linkToken to turn this into a link
      // request rather than a fresh login.
      if (account) {
        const result = await exchangeIdentity(account, token.reciplaseToken);
        if (result.ok) {
          token.reciplaseToken = result.token;
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
      session.accessToken = token.reciplaseToken;
      session.error = token.error;
      if (session.user) {
        session.user.handle = token.handle ?? null;
      }
      return session;
    },
  },
};
