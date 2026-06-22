import '@/styles/main.scss';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/Layout';
import AccessGate from '@/components/AccessGate';
import { useViewTransitionRouter } from '@/lib/viewTransitions';

// Local-only profile: NEXT_PUBLIC_FAKE_AUTH=true injects a signed-in session
// (user@reciplease.org) so the authenticated UI is reachable without Google.
// Pair it with the middleware/AccessGate bypass (see proxy.ts / AccessGate).
const FAKE_AUTH = process.env.NEXT_PUBLIC_FAKE_AUTH === 'true';
const fakeSession: Session | undefined = FAKE_AUTH
  ? {
    user: { name: 'Local User', handle: 'local-dev-user' },
    accessToken: 'fake-local-dev-access-token',
    expires: '2999-12-31T23:59:59.999Z',
  }
  : undefined;

export default function App({
                              Component,
                              pageProps,
                            }: AppProps<{ session?: Session }>) {
  const router = useRouter();
  useViewTransitionRouter(router);
  // The login page renders standalone (no chrome, no AccessGate).
  // login and the scanner are full-screen standalone pages (no header/layout chrome).
  // The handle onboarding page must also stay outside AccessGate, since
  // AccessGate itself redirects here when a signed-in, allowlisted user has no
  // handle yet — wrapping it in AccessGate would loop.
  const standalone =
    router.pathname === '/login' ||
    router.pathname === '/inventory/scan' ||
    router.pathname === '/onboarding/handle';
  // Recipes are publicly readable — show them inside the Layout but without
  // the AccessGate sign-in wall.
  const publicPage =
    router.pathname === '/recipes' ||
    router.pathname === '/recipes/[recipeId]' ||
    // Appearance/accessibility prefs are client-only — no sign-in needed.
    router.pathname === '/settings' ||
    // The invite page handles its own auth: shows a preview + sign-in prompt
    // before the user is signed in, then accepts once they are.
    router.pathname === '/invite/[code]';

  return (
    <SessionProvider
      session={pageProps.session ?? fakeSession}
      // Don't let a background revalidation against /api/auth/session wipe the
      // injected fake session in local dev.
      refetchOnWindowFocus={!FAKE_AUTH}
    >
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {standalone ? (
        <Component {...pageProps} />
      ) : publicPage ? (
        <Layout>
          <Component {...pageProps} />
        </Layout>
      ) : (
        <Layout>
          <AccessGate>
            <Component {...pageProps} />
          </AccessGate>
        </Layout>
      )}
    </SessionProvider>
  );
}
