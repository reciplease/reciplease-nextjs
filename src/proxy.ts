import { withAuth } from 'next-auth/middleware';

// Require a NextAuth session for all pages. API routes are excluded: they are a
// BFF that forwards the bearer token and returns 401/403 itself, and redirecting
// fetch() calls to an HTML sign-in page would break them. Auth, Next internals
// and static assets are also excluded.
export default withAuth({
  // Redirect unauthenticated visitors to our branded page; withAuth lets the
  // sign-in page through itself, so this doesn't loop.
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => token != null,
  },
});

export const config = {
  // Recipes pages are publicly readable — exclude them from the auth gate.
  matcher: ['/((?!api|recipes|_next/static|_next/image|favicon.ico).*)'],
};
