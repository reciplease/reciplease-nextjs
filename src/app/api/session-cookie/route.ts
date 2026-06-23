import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-options';

// The only place that writes the reciplease-session cookie. NextAuth's jwt()/
// session() callbacks (where the Reciplease JWT already lives, via the existing
// /api/auth/exchange call) don't have access to the outgoing response, so they
// can't Set-Cookie anything themselves — this tiny route is the bridge. Called
// once after sign-in (and again after linking a second provider, since the token
// rotates) so the generic API proxy has a cookie to forward to the backend.
export async function GET() {
  const session = await getServerSession(authOptions);
  const jar = await cookies();

  if (session?.accessToken) {
    jar.set('reciplease-session', session.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } else {
    jar.delete('reciplease-session');
  }

  return new Response(null, { status: 204 });
}
