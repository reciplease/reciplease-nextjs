import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '@/pages/Login.module.scss';

// NextAuth appends ?error=… when a sign-in attempt fails; surface a friendly message.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'Access was denied. Your Google account may not be permitted.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again later.',
  Verification: 'That sign-in link is no longer valid. Please try again.',
  default: 'Something went wrong while signing in. Please try again.',
};

function GoogleIcon() {
  return (
    <svg className={styles.icon} viewBox='0 0 18 18' aria-hidden='true'>
      <path
        fill='#4285F4'
        d='M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z'
      />
      <path
        fill='#34A853'
        d='M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z'
      />
      <path
        fill='#FBBC05'
        d='M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z'
      />
      <path
        fill='#EA4335'
        d='M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58Z'
      />
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const callbackUrl =
    typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/recipes';
  const error = typeof router.query.error === 'string' ? router.query.error : undefined;

  return (
    <>
      <Head>
        <title>Sign in · Reciplease</title>
      </Head>
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.brand}>Reciplease</h1>
          <p className={styles.tagline}>Your recipes and kitchen inventory, in one place.</p>

          {error && <p className={styles.error}>{ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}</p>}

          <button className={styles.button} onClick={() => signIn('google', { callbackUrl })}>
            <GoogleIcon />
            Sign in with Google
          </button>

          <p className={styles.note}>Access is limited to allowlisted accounts.</p>
        </section>
      </main>
    </>
  );
}
