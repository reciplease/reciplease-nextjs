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
  // /recipes and /recipes/[recipeId] are publicly readable — excluded from the
  // auth gate. Only those two exact shapes, though: `recipes$` (bare) and
  // `recipes/[^/]+$` (exactly one further segment, e.g. the recipeId) — NOT a
  // blanket "recipes" prefix, so a genuinely gated route with more path after
  // it, like /recipes/[recipeId]/edit, still gets caught here rather than
  // relying on AccessGate alone.
  //
  // /recipes/new is the one gap this can't close: it's the same shape as
  // /recipes/[recipeId] (one segment past /recipes), so there's no way to tell
  // "new" the static route apart from "new" as someone's recipeId using the URL
  // alone — Next.js itself resolves that collision by routing priority, not
  // middleware. AccessGate (client-side) still fully gates it; it just isn't
  // caught at the edge.
  //
  // /invite/[code] is excluded the same way (single segment only) — it handles
  // its own auth (preview before sign-in, accept after); gating it here would
  // redirect straight to /login before the invite preview (house name) renders.
  //
  // / is excluded so Next.js can handle the redirect to /recipes before auth.
  // `.*\..*` excludes any path with a file extension (e.g. /reciplease-book.svg,
  // /logo192.png, /manifest.json) so public static assets — like the header
  // logo — load for signed-out visitors instead of being redirected to /login.
  matcher: [
    '/((?!$|api|recipes$|recipes/[^/]+$|invite/[^/]+$|_next/static|_next/image|favicon\\.ico|.*\\..*).*)',
  ],
};
