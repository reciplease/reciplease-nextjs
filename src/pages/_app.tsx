import '@/styles/main.scss';
import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import AccessGate from '@/components/AccessGate';

export default function App({
  Component,
  pageProps,
}: AppProps<{ session?: Session }>) {
  return (
    <SessionProvider session={pageProps.session}>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
      </Head>
      <Layout>
        <AccessGate>
          <Component {...pageProps} />
        </AccessGate>
      </Layout>
    </SessionProvider>
  );
}
