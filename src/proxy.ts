import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { isJwtExpired } from '@/lib/jwt';

// Require a NextAuth session for all pages. API routes are excluded: they are a
// BFF that forwards the bearer token and returns 401/403 itself, and redirecting
// fetch() calls to an HTML sign-in page would break them. Auth, Next internals
// and static assets are also excluded.
//
// Set NEXT_PUBLIC_AUTH_DISABLED=true to bypass auth entirely (local dev only).
const authMiddleware = withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    // A decodable NextAuth session cookie isn't enough on its own — its embedded
    // Reciplease JWT (auth-options.ts's jwt callback) has its own, shorter expiry
    // and can be flagged with an error (e.g. a failed sign-in exchange) independently
    // of the outer cookie still being valid. Checking both here, at the edge, means an
    // expired/errored session redirects to /login before any page ever renders —
    // instead of the page mounting as "signed in" and only discovering otherwise once
    // a client-side backend call 401s a moment later.
    authorized: ({ token }) => {
      if (token == null || token.error) return false;
      const recipleaseToken = token.recipleaseToken as string | undefined;
      return !recipleaseToken || !isJwtExpired(recipleaseToken);
    },
  },
});

export default function middleware(req: NextRequest, event: Parameters<typeof authMiddleware>[1]) {
  if (
    process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' ||
    process.env.NEXT_PUBLIC_FAKE_AUTH === 'true'
  ) {
    return NextResponse.next();
  }
  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  // Recipes pages are publicly readable — exclude them from the auth gate.
  // Invite pages handle their own auth (preview before sign-in, accept after)
  // — gating them here would redirect straight to /login before the invite
  // preview (house name) ever renders.
  // / is excluded so Next.js can handle the redirect to /recipes before auth.
  // `.*\..*` excludes any path with a file extension (e.g. /reciplease-book.svg,
  // /logo192.png, /manifest.json) so public static assets — like the header
  // logo — load for signed-out visitors instead of being redirected to /login.
  matcher: ['/((?!$|api|recipes|invite|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
