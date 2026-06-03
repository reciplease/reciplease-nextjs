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
  // The login page is the unauthenticated entry point, so it renders standalone
  // (no app chrome) and outside AccessGate, which would otherwise intercept it.
  const standalone = router.pathname === '/login';

  return (
    <SessionProvider session={pageProps.session}>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
      </Head>
      {standalone ? (
        <Component {...pageProps} />
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
