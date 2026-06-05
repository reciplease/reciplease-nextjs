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
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true') {
    return NextResponse.next();
  }
  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  // Recipes pages are publicly readable — exclude them from the auth gate.
  // / is excluded so Next.js can handle the redirect to /recipes before auth.
  matcher: ['/((?!$|api|recipes|_next/static|_next/image|favicon.ico).*)'],
};
