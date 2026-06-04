import '@/styles/main.scss';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/Layout';
import AccessGate from '@/components/AccessGate';

export default function App({
  Component,
  pageProps,
}: AppProps<{ session?: Session }>) {
  const router = useRouter();
  // The login page renders standalone (no chrome, no AccessGate).
  const standalone = router.pathname === '/login';
  // Recipes are publicly readable — show them inside the Layout but without
  // the AccessGate sign-in wall.
  const publicPage =
    router.pathname === '/recipes' || router.pathname === '/recipes/[recipeId]';

  return (
    <SessionProvider session={pageProps.session}>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
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
