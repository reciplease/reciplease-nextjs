import { withAuth } from 'next-auth/middleware';

// Require a NextAuth session for all pages. API routes are excluded: they are a
// BFF that forwards the bearer token and returns 401/403 itself, and redirecting
// fetch() calls to an HTML sign-in page would break them. Auth, Next internals
// and static assets are also excluded.
export default withAuth({
  callbacks: {
    authorized: ({ token }) => token != null,
  },
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
