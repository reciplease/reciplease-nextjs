import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth-options';

const handler = NextAuth(authOptions);

// Local-only: NEXT_PUBLIC_FAKE_AUTH=true makes the session endpoint report a
// signed-in user (user@reciplease.org). next-auth's SessionProvider refetches
// /api/auth/session on mount, so without this it would overwrite the injected
// fake session with null. Only the GET /session route is faked; everything else
// (sign-in/out, callbacks) falls through to the real NextAuth handler.
const FAKE_AUTH = process.env.NEXT_PUBLIC_FAKE_AUTH === 'true';
const fakeSession = {
  user: { name: 'Local User', email: 'user@reciplease.org' },
  expires: '2999-12-31T23:59:59.999Z',
};

async function GET(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  if (FAKE_AUTH) {
    const { nextauth } = await ctx.params;
    if (nextauth?.[0] === 'session') {
      return NextResponse.json(fakeSession);
    }
  }
  return handler(req, ctx);
}

export { GET, handler as POST };
