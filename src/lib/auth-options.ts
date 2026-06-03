import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';

// We forward Google's id_token to the backend as a bearer token; the backend
// (an OAuth2 resource server) validates it and enforces the allowlist. id_tokens
// expire after ~1h, so we keep the refresh_token and mint a fresh one on demand.

async function refreshIdToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken ?? '',
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      idToken: refreshed.id_token ?? token.idToken,
      // expires_in is seconds from now.
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      // Google may not return a new refresh_token; keep the existing one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          // `email` scope is required so the id_token carries email/email_verified,
          // which the backend allowlist is keyed on.
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  // Use our own branded sign-in page instead of NextAuth's default UI.
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist the Google tokens.
      if (account) {
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // Still valid (60s safety margin)? Reuse it.
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }

      // Expired: try to refresh.
      return refreshIdToken(token);
    },
    async session({ session, token }) {
      // Never expose raw tokens to the browser; only surface a refresh-error flag
      // so the client can prompt re-authentication.
      session.error = token.error;
      return session;
    },
  },
};
