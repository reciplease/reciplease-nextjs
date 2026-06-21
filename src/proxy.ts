import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';

// Require a NextAuth session for all pages. API routes are excluded: they are a
// BFF that forwards the bearer token and returns 401/403 itself, and redirecting
// fetch() calls to an HTML sign-in page would break them. Auth, Next internals
// and static assets are also excluded.
//
// Set NEXT_PUBLIC_AUTH_DISABLED=true to bypass auth entirely (local dev only).
const authMiddleware = withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => token != null,
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
